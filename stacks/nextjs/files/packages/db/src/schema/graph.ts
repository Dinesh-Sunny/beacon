// One shared, organization-scoped edge table linking any two records (docs/knowledge/graph.md).
// Ends are (kind, id) pairs, not foreign keys, so any uuid-keyed record (auth, Payload, app) can be
// a node. Text-keyed records (agent_threads, consent) need a feature edge table of their own. Without FKs, deleting a record doesn't remove its
// edges; call deleteNodeEdges() from the same code path. Deleting the organization removes them all.
// Walk it with walkGraph() from graph.ts.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.ts";

export const graphEdges = pgTable(
  "graph_edges",
  {
    id: uuid().default(sql`pg_catalog.uuidv7()`).primaryKey(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // What each end is, e.g. "user", "page", "product"; the edge type usually implies it.
    srcKind: text().notNull(),
    srcId: uuid().notNull(),
    // Verb in the src → dst direction, e.g. "follows", "member_of", "bought_with".
    type: text().notNull(),
    dstKind: text().notNull(),
    dstId: uuid().notNull(),
    weight: real().default(1).notNull(),
    props: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Node id leads both indexes: walks filter on node, type, and organization by equality, and
    // deleteNodeEdges() looks a node up across every organization it appears in.
    // Also serves outgoing walks.
    unique("graph_edges_unique").on(
      table.srcId,
      table.type,
      table.organizationId,
      table.dstId,
    ),
    // Incoming walks (direction "in"); src_id last so the walk reads only the index.
    index("graph_edges_incoming_idx").on(
      table.dstId,
      table.type,
      table.organizationId,
      table.srcId,
    ),
    // Organization deletes cascade through this foreign key.
    index("graph_edges_organization_id_idx").on(table.organizationId),
    check("graph_edges_no_self_loop", sql`${table.srcId} <> ${table.dstId}`),
  ],
);
