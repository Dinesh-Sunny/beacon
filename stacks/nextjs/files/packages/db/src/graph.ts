// Graph and tree helpers on plain Postgres (docs/knowledge/graph.md): an ltree column type, ltree
// path building and filters, and a capped, tenant-scoped walk over any edge table.
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { customType, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { type Database, getDb } from "./client.ts";
import { GRAPH_WALK, LTREE_LABEL, PG_ERROR } from "./config.ts";
import { graphEdges } from "./schema/graph.ts";

// Needs the ltree extension (migration 0010). Values travel as text, e.g. "root.child".
export const ltree = customType<{ data: string; driverData: string }>({
  dataType() {
    return "ltree";
  },
});

export class GraphInputError extends Error {
  override name = "GraphInputError";
}

// The walk hit GRAPH_WALK.timeoutMs: the graph is too dense for this depth. Lower maxDepth or
// narrow types; retrying the same walk won't help.
export class GraphWalkTimeoutError extends Error {
  override name = "GraphWalkTimeoutError";
}

// Drizzle wraps pg errors in DrizzleQueryError; the SQLSTATE sits on the cause.
function sqlState(error: unknown): string | undefined {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ("code" in current && typeof current.code === "string")
      return current.code;
  }
  return undefined;
}

// Joins labels into an ltree path, rejecting labels Postgres would refuse. Use ids, not display
// names, as labels so a rename never rewrites a subtree.
export function ltreePath(...labels: readonly string[]): string {
  if (labels.length === 0) throw new GraphInputError("ltree path is empty");
  for (const label of labels) {
    if (!LTREE_LABEL.test(label)) {
      throw new GraphInputError(
        `invalid ltree label: ${JSON.stringify(label)}`,
      );
    }
  }
  return labels.join(".");
}

// The node at `path` and everything below it. GiST-indexed (gist_ltree_ops).
export function inSubtree(column: PgColumn, path: string): SQL {
  return sql`${column} <@ ${path}::ltree`;
}

// The node at `path` and every ancestor up to the root. GiST-indexed (gist_ltree_ops).
export function isAncestorOf(column: PgColumn, path: string): SQL {
  return sql`${column} @> ${path}::ltree`;
}

export type GraphEdges = {
  table: PgTable;
  src: PgColumn;
  dst: PgColumn;
  type: PgColumn;
  organizationId: PgColumn;
};

export type WalkOptions = {
  // Defaults to the shared graph_edges table.
  edges?: GraphEdges;
  from: string;
  organizationId: string;
  // Edge types to follow; an empty list follows nothing.
  types: readonly string[];
  // "out" follows src → dst, "in" follows dst → src.
  direction?: "out" | "in";
  maxDepth?: number;
  limit?: number;
};

// The shared graph_edges table in the shape walkGraph() takes.
export const GRAPH_EDGES: GraphEdges = {
  table: graphEdges,
  src: graphEdges.srcId,
  dst: graphEdges.dstId,
  type: graphEdges.type,
  organizationId: graphEdges.organizationId,
};

export type ReachedNode = { nodeId: string; hops: number };

// Nodes reachable from `from` within `maxDepth` hops, nearest first, start node excluded.
// UNION over (node, depth) keeps each node once per level, so work grows with depth times
// reachable edges. UNION ALL with CYCLE would follow every distinct path: exponential in depth.
// The depth cap ends cycles. Tenant filter and depth cap sit in the recursive term, where they
// bound the work. `from` and `organizationId` must match the edge columns' types (uuid for
// graph_edges); a malformed value throws GraphInputError.
export async function walkGraph(
  options: WalkOptions,
  db: Database = getDb(),
): Promise<ReachedNode[]> {
  const {
    edges = GRAPH_EDGES,
    from,
    organizationId,
    types,
    direction = "out",
    maxDepth = GRAPH_WALK.defaultDepth,
    limit = GRAPH_WALK.maxRows,
  } = options;
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > GRAPH_WALK.maxDepth
  ) {
    throw new GraphInputError(`maxDepth must be 1–${GRAPH_WALK.maxDepth}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > GRAPH_WALK.maxRows) {
    throw new GraphInputError(`limit must be 1–${GRAPH_WALK.maxRows}`);
  }
  if (types.length === 0) return [];

  const [near, far] =
    direction === "out" ? [edges.src, edges.dst] : [edges.dst, edges.src];
  // The seed is a bound parameter; cast it to the edge column's type so both UNION terms agree.
  const nodeType = sql.raw(near.getSQLType());

  const query = sql`
    with recursive walk (node_id, depth) as (
        select cast(${from} as ${nodeType}), 0
      union
        select ${far}, walk.depth + 1
        from ${edges.table}
        join walk on ${near} = walk.node_id
        where ${and(eq(edges.organizationId, organizationId), inArray(edges.type, [...types]))}
          and walk.depth < ${maxDepth}
    )
    select node_id::text as "nodeId", min(depth)::int as hops
    from walk
    where depth > 0 and node_id <> cast(${from} as ${nodeType})
    group by node_id
    order by hops, node_id
    limit ${limit}`;

  try {
    return await db.transaction(async (tx) => {
      // SET LOCAL that takes a parameter; scoped to this transaction, so safe on the pooler.
      await tx.execute(
        sql`select set_config('statement_timeout', ${String(GRAPH_WALK.timeoutMs)}, true)`,
      );
      const result = await tx.execute<ReachedNode>(query);
      return result.rows;
    });
  } catch (error) {
    const code = sqlState(error);
    if (code === PG_ERROR.queryCanceled) {
      throw new GraphWalkTimeoutError(
        `graph walk exceeded ${GRAPH_WALK.timeoutMs} ms at maxDepth ${maxDepth}`,
        { cause: error },
      );
    }
    if (code === PG_ERROR.invalidTextRepresentation) {
      throw new GraphInputError(
        "node or organization id has the wrong format",
        {
          cause: error,
        },
      );
    }
    throw error;
  }
}

// graph_edges ends aren't foreign keys, so call this wherever a node's record is deleted (in the
// same transaction when there is one). Covers every organization the node appears in.
export async function deleteNodeEdges(
  nodeId: string,
  db: Pick<Database, "delete"> = getDb(),
): Promise<number> {
  const result = await db
    .delete(graphEdges)
    .where(or(eq(graphEdges.srcId, nodeId), eq(graphEdges.dstId, nodeId)));
  return result.rowCount ?? 0;
}
