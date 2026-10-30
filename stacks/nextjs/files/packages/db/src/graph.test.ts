import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { asc, eq } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { Database } from "./client.ts";
import { GRAPH_WALK, ROLE_TIMEOUTS } from "./config.ts";
import {
  deleteNodeEdges,
  type GraphEdges,
  GraphInputError,
  inSubtree,
  isAncestorOf,
  ltree,
  ltreePath,
  walkGraph,
} from "./graph.ts";
import { organization } from "./schema/auth.ts";
import { graphEdges } from "./schema/graph.ts";
import { createScratchDatabase, type ScratchDatabase } from "./testing.ts";

const skip = process.env.DATABASE_URL_UNPOOLED
  ? false
  : "DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

// Test-only tables, created by hand in the scratch database below.
const edgesTable = pgTable("test_edges", {
  organizationId: text().notNull(),
  srcId: uuid().notNull(),
  dstId: uuid().notNull(),
  type: text().notNull(),
});
const categories = pgTable("test_categories", {
  id: uuid().primaryKey(),
  path: ltree().notNull(),
});

const EDGES: GraphEdges = {
  table: edgesTable,
  src: edgesTable.srcId,
  dst: edgesTable.dstId,
  type: edgesTable.type,
  organizationId: edgesTable.organizationId,
};

const ORG = "org-a";
const DENSE_ORG = "org-dense";
const DENSE_BASE = 1_000;
const DENSE_NODES = 200;
const DENSE_FAN_OUT = 15;

// Drizzle wraps the pg error; the constraint name is on its cause.
const violates = (constraint: string) => (error: unknown) =>
  error instanceof Error &&
  (error.cause as { constraint?: string } | undefined)?.constraint ===
    constraint;
const node = (n: number) =>
  `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

describe("ltreePath", () => {
  test("should join valid labels, including uuids", () => {
    assert.equal(ltreePath("root", node(1)), `root.${node(1)}`);
  });

  test("should reject empty paths and labels Postgres refuses", () => {
    assert.throws(() => ltreePath(), GraphInputError);
    assert.throws(() => ltreePath("root", "has.dot"), GraphInputError);
    assert.throws(() => ltreePath("root", "has space"), GraphInputError);
    assert.throws(() => ltreePath(""), GraphInputError);
  });
});

describe("walkGraph input", () => {
  // Validation runs before any query, so no database is needed.
  const db = {} as Database;
  const base = {
    edges: EDGES,
    from: node(1),
    organizationId: ORG,
    types: ["follows"],
  };

  test("should reject depths outside the cap", async () => {
    await assert.rejects(
      walkGraph({ ...base, maxDepth: 0 }, db),
      GraphInputError,
    );
    await assert.rejects(
      walkGraph({ ...base, maxDepth: GRAPH_WALK.maxDepth + 1 }, db),
      GraphInputError,
    );
    await assert.rejects(
      walkGraph({ ...base, maxDepth: 1.5 }, db),
      GraphInputError,
    );
  });

  test("should reject limits outside the cap", async () => {
    await assert.rejects(
      walkGraph({ ...base, limit: GRAPH_WALK.maxRows + 1 }, db),
      GraphInputError,
    );
  });

  test("should return nothing when no edge types are given", async () => {
    assert.deepEqual(await walkGraph({ ...base, types: [] }, db), []);
  });
});

describe("graph queries", { skip }, () => {
  let scratch: ScratchDatabase | undefined;
  let db: Database;

  before(async () => {
    // Migrated like production (extensions from 0010); one connection, so a leaked timeout shows.
    scratch = await createScratchDatabase();
    db = scratch.db;
    await scratch.pool.query(`
      create table test_edges (organization_id text not null, src_id uuid not null, dst_id uuid not null, type text not null);
      create table test_categories (id uuid primary key, path ltree not null);
      create index on test_categories using gist (path);
    `);
    // 1 → 2 → 3 → 1 (cycle), 3 → 4, 1 → 3 (shortcut), 4 → 5 (other type), plus another tenant's edge.
    const edges: [number, number, string, string][] = [
      [1, 2, "follows", ORG],
      [2, 3, "follows", ORG],
      [3, 1, "follows", ORG],
      [3, 4, "follows", ORG],
      [1, 3, "follows", ORG],
      [4, 5, "blocks", ORG],
      [1, 6, "follows", "org-b"],
    ];
    // Dense tenant: DENSE_NODES nodes with DENSE_FAN_OUT out-edges each. Following every path
    // (UNION ALL) explodes here by depth 6; the walk must stay well under the timeout.
    for (let i = 0; i < DENSE_NODES; i++) {
      for (let k = 1; k <= DENSE_FAN_OUT; k++) {
        edges.push([
          DENSE_BASE + i,
          DENSE_BASE + ((i * 7 + k * 13) % DENSE_NODES),
          "follows",
          DENSE_ORG,
        ]);
      }
    }
    await db.insert(edgesTable).values(
      edges.map(([src, dst, type, organizationId]) => ({
        srcId: node(src),
        dstId: node(dst),
        type,
        organizationId,
      })),
    );
    await db.insert(categories).values([
      { id: node(10), path: ltreePath("root") },
      { id: node(11), path: ltreePath("root", node(11)) },
      { id: node(12), path: ltreePath("root", node(11), node(12)) },
      { id: node(13), path: ltreePath("root", node(13)) },
    ]);
  });

  after(async () => {
    await scratch?.drop();
  });

  test("should return each reachable node once at its shortest hop count", async () => {
    const reached = await walkGraph(
      { edges: EDGES, from: node(1), organizationId: ORG, types: ["follows"] },
      db,
    );
    assert.deepEqual(reached, [
      { nodeId: node(2), hops: 1 },
      { nodeId: node(3), hops: 1 },
      { nodeId: node(4), hops: 2 },
    ]);
  });

  test("should stop at maxDepth", async () => {
    const reached = await walkGraph(
      {
        edges: EDGES,
        from: node(1),
        organizationId: ORG,
        types: ["follows"],
        maxDepth: 1,
      },
      db,
    );
    assert.deepEqual(
      reached.map((r) => r.nodeId),
      [node(2), node(3)],
    );
  });

  test("should follow edges backwards when direction is in", async () => {
    const reached = await walkGraph(
      {
        edges: EDGES,
        from: node(4),
        organizationId: ORG,
        types: ["follows"],
        direction: "in",
        maxDepth: 1,
      },
      db,
    );
    assert.deepEqual(reached, [{ nodeId: node(3), hops: 1 }]);
  });

  test("should follow only the given edge types", async () => {
    const reached = await walkGraph(
      {
        edges: EDGES,
        from: node(1),
        organizationId: ORG,
        types: ["follows", "blocks"],
      },
      db,
    );
    assert.deepEqual(
      reached.map((r) => r.nodeId),
      [node(2), node(3), node(4), node(5)],
    );
  });

  test("should see only the given organization's edges", async () => {
    const otherTenant = await walkGraph(
      {
        edges: EDGES,
        from: node(1),
        organizationId: "org-b",
        types: ["follows"],
      },
      db,
    );
    assert.deepEqual(otherTenant, [{ nodeId: node(6), hops: 1 }]);
  });

  test("should return at most limit nodes, nearest first", async () => {
    const reached = await walkGraph(
      {
        edges: EDGES,
        from: node(1),
        organizationId: ORG,
        types: ["follows"],
        limit: 1,
      },
      db,
    );
    assert.deepEqual(reached, [{ nodeId: node(2), hops: 1 }]);
  });

  test("should finish a dense graph at the depth cap within the timeout", async () => {
    const reached = await walkGraph(
      {
        edges: EDGES,
        from: node(DENSE_BASE),
        organizationId: DENSE_ORG,
        types: ["follows"],
        maxDepth: GRAPH_WALK.maxDepth,
      },
      db,
    );
    assert.ok(reached.length > 0);
    assert.ok(reached.every((r) => r.hops <= GRAPH_WALK.maxDepth));
  });

  test("should keep the walk's timeout inside its transaction", async () => {
    await walkGraph(
      { edges: EDGES, from: node(1), organizationId: ORG, types: ["follows"] },
      db,
    );
    assert.ok(scratch);
    const { rows } = await scratch.pool.query<{ statement_timeout: string }>(
      "show statement_timeout",
    );
    // The role default from migration 0014, not the walk's 2 s.
    assert.equal(rows[0]?.statement_timeout, ROLE_TIMEOUTS.statement_timeout);
  });

  test("should throw GraphInputError when the start id is malformed", async () => {
    await assert.rejects(
      walkGraph(
        {
          edges: EDGES,
          from: "not-a-uuid",
          organizationId: ORG,
          types: ["follows"],
        },
        db,
      ),
      GraphInputError,
    );
  });

  test("should find a subtree with inSubtree", async () => {
    const subtree = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inSubtree(categories.path, ltreePath("root", node(11))))
      .orderBy(asc(categories.path));
    assert.deepEqual(
      subtree.map((row) => row.id),
      [node(11), node(12)],
    );
  });

  test("should find ancestors with isAncestorOf", async () => {
    const ancestors = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        isAncestorOf(categories.path, ltreePath("root", node(11), node(12))),
      )
      .orderBy(asc(categories.path));
    assert.deepEqual(
      ancestors.map((row) => row.id),
      [node(10), node(11), node(12)],
    );
  });

  describe("graph_edges", () => {
    const orgId = node(100);
    const otherOrgId = node(101);
    const edge = (src: number, dst: number, organizationId = orgId) => ({
      organizationId,
      srcKind: "user",
      srcId: node(src),
      type: "follows",
      dstKind: "user",
      dstId: node(dst),
    });

    before(async () => {
      await db.insert(organization).values([
        { id: orgId, name: "A", slug: "graph-a", createdAt: new Date() },
        { id: otherOrgId, name: "B", slug: "graph-b", createdAt: new Date() },
      ]);
      await db
        .insert(graphEdges)
        .values([edge(1, 2), edge(2, 3), edge(3, 1), edge(1, 4, otherOrgId)]);
    });

    test("should be what walkGraph walks by default", async () => {
      const reached = await walkGraph(
        { from: node(1), organizationId: orgId, types: ["follows"] },
        db,
      );
      assert.deepEqual(reached, [
        { nodeId: node(2), hops: 1 },
        { nodeId: node(3), hops: 2 },
      ]);
    });

    test("should reject an edge when the same one exists", async () => {
      await assert.rejects(
        db.insert(graphEdges).values(edge(1, 2)),
        violates("graph_edges_unique"),
      );
    });

    test("should reject an edge when it points at its own source", async () => {
      await assert.rejects(
        db.insert(graphEdges).values(edge(5, 5)),
        violates("graph_edges_no_self_loop"),
      );
    });

    test("should delete a node's edges in every organization", async () => {
      assert.equal(await deleteNodeEdges(node(1), db), 3);
      const left = await db.select({ src: graphEdges.srcId }).from(graphEdges);
      assert.deepEqual(left, [{ src: node(2) }]);
    });

    test("should delete edges with their organization", async () => {
      await db.delete(organization).where(eq(organization.id, orgId));
      assert.deepEqual(await db.select().from(graphEdges), []);
    });
  });
});
