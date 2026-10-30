<!-- last-verified: 2026-10-03 -->
# Graph data on Postgres

How to model and query graphs (follows, org charts, permissions, knowledge graphs, GraphRAG) in the Postgres we already run, with no graph database. Read before adding nodes, edges, trees, or traversal queries.

## Decision

Graphs live in plain Postgres 18 tables: an edge table walked with `WITH RECURSIVE`, `ltree` for pure trees, and graph algorithms in the Python sidecar. Every piece works the same locally, on Neon, and on PlanetScale. Add a graph database (Neo4j) only when deep traversals or graph algorithms become a core, latency-bound feature, and then sync edges one way from Postgres.

## What Postgres does not have (checked 2026-10-03)

| Feature | Status |
| --- | --- |
| SQL/PGQ (`CREATE PROPERTY GRAPH`, `GRAPH_TABLE ... MATCH`) | Committed for Postgres 19 in March 2026, reverted on 2026-09-07 (path variables and shortest path unfinished). Postgres 20 (Sept 2027) at the earliest. |
| Apache AGE (Cypher) | Supports Postgres 18, but neither Neon nor PlanetScale offers it. |
| pgrouting (Dijkstra, A*, components) | Neon only (needs PostGIS). PlanetScale has PostGIS but not pgrouting; our local image has neither. |
| pg_ivm (self-refreshing materialized views) | Neon only. |
| `pg_hint_plan` | Neon and PlanetScale, not the local image. Last-resort plan fix only. |
| Drizzle `WITH RECURSIVE` | Not in Drizzle 0.45 (issue #209). Write traversals with the `sql` template. |

## Extensions to use

All four ship with the official Postgres image and are listed on Neon and PlanetScale (PlanetScale: plain `CREATE EXTENSION`, no superuser, no restart). Local versions on Postgres 18.4: `ltree` 1.3, `btree_gist` 1.8, `intarray` 1.5, `tablefunc` 1.0.

| Extension | Use |
| --- | --- |
| `ltree` | Trees: categories, org charts, comment threads, folder paths |
| `btree_gist` | Time-ranged edges (`WITHOUT OVERLAPS` on uuid or text columns) |
| `vector`, `pg_trgm` (installed) | GraphRAG entry points; fuzzy entity matching when merging duplicates |
| `intarray`, `tablefunc` | Rarely needed: integer ID sets; legacy `connectby()` |

`ltree` and `btree_gist` are installed by migration `0010_graph_extensions.sql`; `packages/db/src/db.test.ts` asserts every required extension after migrating.

## Postgres 18 features that help

- `uuidv7()`: time-ordered ids for nodes and edges; better index locality than `gen_random_uuid()`.
- Skip scan: a `(type, src_id)` B-tree also serves `src_id`-only lookups when `type` has few distinct values.
- Temporal keys: `PRIMARY KEY (..., valid_at WITHOUT OVERLAPS)` and `FOREIGN KEY (..., PERIOD valid_at)` for edges valid over a time range.
- `OLD`/`NEW` in `RETURNING`: write an edge change and its audit row in one statement.
- Async I/O, `OR`-to-index rewrites, parallel GIN builds, and `EXPLAIN` showing buffers by default.

Postgres 19 (beta, not on either provider yet) adds `ON CONFLICT DO SELECT ... RETURNING`, which returns an existing edge on insert conflicts.

## Helpers in `@__NAME__/db`

`packages/db/src/graph.ts`, tested against a real database in `graph.test.ts`. Limits live in `GRAPH_WALK` and `LTREE_LABEL` in `packages/db/src/config.ts`.

| Export | Does |
| --- | --- |
| `ltree` | Drizzle column type for `ltree` (`path: ltree().notNull()`) |
| `ltreePath(...labels)` | Joins labels into a path; throws `GraphInputError` on labels Postgres refuses |
| `inSubtree(col, path)`, `isAncestorOf(col, path)` | `<@` and `@>` filters for `.where()` |
| `walkGraph({ from, organizationId, types, direction, maxDepth, limit, edges })` | Nodes reachable within `maxDepth` hops, nearest first, as `{ nodeId, hops }` |
| `GraphInputError`, `GraphWalkTimeoutError` | Bad input (caps, malformed ids, ltree labels); walk too dense for its depth |
| `deleteNodeEdges(nodeId)` | Removes a node's `graph_edges` rows in every organization |
| `GRAPH_EDGES` | `graph_edges` in the shape `walkGraph` takes (its default) |

`walkGraph` walks `graph_edges` by default; pass `edges` (a table plus its `src`, `dst`, `type`, `organizationId` columns) to walk a feature's own edge table. It runs the traversal below in a transaction with a 2 s `statement_timeout`, caps depth at 6 and rows at 1000, and rejects anything outside those caps.

```ts
const reached = await walkGraph({
  from: userId,
  organizationId,
  types: ["follows"],
  maxDepth: 2,
});
```

## Patterns

| Pattern | Use when | Cost |
| --- | --- | --- |
| Edge table + `WITH RECURSIVE` | General graphs; the default | Grows with depth times reachable edges |
| `ltree` materialized path | Strict trees, many subtree reads | Moving a subtree rewrites its descendants' paths |
| Closure table (every ancestor/descendant pair) | Hot reachability checks ("can X reach Y?") | Rows grow with depth; maintain in the edge write's transaction |
| Relation tuples `(object, relation, subject)` | Relationship-based permissions on top of organizations | Check with a capped recursive query; cache per request |
| Vector search + 1–2 hop expand | GraphRAG for agents | Two queries, or one CTE |
| Python sidecar | PageRank, communities, shortest path at scale | Load a bounded subgraph; NetworkX, rustworkx, or igraph |

### The shared `graph_edges` table

`packages/db/src/schema/graph.ts` (migrations `0011_graph_edges.sql`, `0012_graph_edges_incoming_covering.sql`). One table for every relation a template feature needs until a feature outgrows it:

| Column | Notes |
| --- | --- |
| `id` | `uuidv7()` |
| `organization_id` | Tenant; deleting the organization deletes its edges |
| `src_kind`, `src_id`, `dst_kind`, `dst_id` | Each end is a kind (`"user"`, `"page"`, `"product"`) plus a uuid. Not foreign keys: any uuid-keyed record can be a node. Text-keyed ones (`agent_threads`, consent) need their own edge table |
| `type` | Verb in the src → dst direction (`"follows"`, `"member_of"`) |
| `weight`, `props` | Ranking weight (default 1) and free-form `jsonb` |

- Constraints: unique `(src_id, type, organization_id, dst_id)`; no self-loops.
- Indexes lead with the node id: the unique index serves outgoing walks, `(dst_id, type, organization_id, src_id)` incoming walks (index-only), both serve `deleteNodeEdges`; `organization_id` has its own for cascades.
- Ends aren't foreign keys, so deleting a record leaves its edges. Call `deleteNodeEdges(id)` in the same code path, and in GDPR deletion for users.
- Keep kinds and edge types in one constants module per feature; no inline strings.
- Store an undirected relation as two rows, or walk both directions; pick one per edge type and say which in a comment.
- Give a feature its own edge table, with real foreign keys, when it needs them or has its own columns. `walkGraph` takes any edge table through `edges`.

### Traversal

`UNION` over `(node_id, depth)`, seeded with the start node at depth 0, which is dropped from the result:

```sql
WITH RECURSIVE walk (node_id, depth) AS (
    SELECT $1::uuid, 0
  UNION
    SELECT e.dst_id, w.depth + 1
    FROM graph_edges e
    JOIN walk w ON e.src_id = w.node_id
    WHERE e.organization_id = $2 AND e.type = $3 AND w.depth < $4
)
SELECT node_id, min(depth) AS hops
FROM walk
WHERE depth > 0 AND node_id <> $1::uuid
GROUP BY node_id
ORDER BY hops;
```

- `UNION` keeps each node once per depth level, so work grows with depth times the edges reachable at each level. The depth cap ends cycles.
- Don't use `UNION ALL` with `CYCLE` for reachability. `CYCLE` only stops a path revisiting its own nodes; the walk still follows every distinct path, which is exponential in depth. On 200 nodes with 15 out-edges each, depth 6 went from timing out at 2 s to 3.6 ms after the switch.
- `CYCLE` (and `SEARCH`) are for when you need the paths themselves: route display, "how is X connected to Y". Keep those walks to 2–3 hops on small graphs.
- Put the depth cap and the tenant filter in the recursive term, not the outer query; the outer query can't stop recursion.
- `LIMIT` doesn't reduce the work here: `GROUP BY` and `ORDER BY` read the whole walk first.

`walkGraph` builds this query and turns a timeout into `GraphWalkTimeoutError` and a malformed id into `GraphInputError`. For a variant it doesn't cover, write it with the `sql` template so values stay bound parameters.

### Trees with ltree

```sql
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  path ltree NOT NULL UNIQUE
);
CREATE INDEX categories_path_gist ON categories USING gist (path gist_ltree_ops(siglen = 100));
```

| Query | SQL |
| --- | --- |
| Subtree (node and descendants) | `path <@ 'root.a'` |
| Ancestors (node and its parents) | `path @> 'root.a.b'` |
| Exact depth below root | `path ~ 'root.*{1}'` (`lquery`) |
| Depth, parent path | `nlevel(path)`, `subpath(path, 0, -1)` |

- Labels allow letters, digits, `_` and `-` (C locale), up to 1000 characters; paths up to 65535 labels. UUID labels work.
- Use the node id as the label, not a display name, so renames don't rewrite paths.
- GiST handles `@>`, `<@`, `~`, `?`. The default 8-byte signature is lossy; a bigger `siglen` (multiple of 4, up to 2024) means fewer false hits and a bigger index.
- B-tree on `ltree` sorts in tree-traversal order, which renders a whole tree with one `ORDER BY path`.
- In Drizzle, declare the column with the `ltree` type from `@__NAME__/db` and the index with `.using("gist", table.path.op("gist_ltree_ops"))`. Set `siglen` in a hand-written migration.

### Time-ranged edges

```sql
CREATE TABLE memberships (
  member_id uuid NOT NULL,
  group_id uuid NOT NULL,
  valid_at tstzrange NOT NULL,
  PRIMARY KEY (member_id, group_id, valid_at WITHOUT OVERLAPS)
);
-- current: WHERE valid_at @> now()
```

- `WITHOUT OVERLAPS` goes on the last key column, which must be a non-empty range or multirange. Uuid or text columns before it need `btree_gist`.
- A `PERIOD` foreign key must reference a `WITHOUT OVERLAPS` key and supports only `NO ACTION`: no `CASCADE`, `SET NULL`, `SET DEFAULT`, or `RESTRICT`. Delete dependents in app code.

## Where the template uses it

Nothing built yet writes to `graph_edges`; explore these as the product needs them (`docs/knowledge/template-modules.md`), starting on `graph_edges` and the helpers above.

| Module | Shape | Use |
| --- | --- | --- |
| Agent knowledge graph (GraphRAG, agent memory) | Entities with embeddings + typed edges per organization | `vector` search for entry nodes, `walkGraph` 1–2 hops; Python reads the same tables |
| Recommendations | Product co-purchase and co-view edges with weights | `walkGraph` 2 hops, rank by weight; fallback beside pgvector similarity |
| Referrals | Referrer tree per user | `ltree` path for "everyone under X" and payout levels; `walkGraph` `in` for upline |
| Roles and permissions | Relation tuples on org resources (teams, folders, projects) | `walkGraph` for "can X reach Y?"; closure table if checks get hot |
| Community, comments | Reply threads | `ltree` path per comment; one `ORDER BY path` renders a thread |
| Categories, docs navigation | App-owned trees outside Payload | `ltree`; Payload-owned trees use Payload's nested-docs plugin instead |
| Memberships, plans, price lists over time | Time-ranged relations | `WITHOUT OVERLAPS` keys (`btree_gist`) |

## Rules

- Every edge row and every traversal filter carries `organization_id`; recursive queries ignore what the outer query filters.
- Every recursive query has a depth cap in the recursive term and runs with `SET LOCAL statement_timeout` inside a transaction (safe on the transaction pooler; plain `SET` is not).
- Check traversal plans with `EXPLAIN (ANALYZE)` on production-sized data before shipping; density, not row count, decides cost.
- Keep Postgres the source of truth. A graph database, if one is added, is a read copy fed one way.
- Run graph algorithms in `python/api` on a bounded subgraph, never as request-time SQL loops.

## Sources

- Postgres 18: [WITH queries](https://www.postgresql.org/docs/18/queries-with.html), [ltree](https://www.postgresql.org/docs/18/ltree.html), [CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html), [release](https://www.postgresql.org/about/news/postgresql-18-released-3142/)
- Postgres 19: [release notes](https://www.postgresql.org/docs/19/release-19.html), [SQL/PGQ revert](https://www.commandprompt.com/blog/two-features-just-left-postgresql-19/)
- Providers: [Neon extensions](https://neon.com/docs/extensions/pg-extensions), [PlanetScale extensions](https://planetscale.com/docs/postgres/extensions)
- [Apache AGE roadmap](https://github.com/apache/age/discussions/2305), [Drizzle issue #209](https://github.com/drizzle-team/drizzle-orm/issues/209)
