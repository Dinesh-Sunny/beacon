// Conversations with AI agents (python/api). LangGraph keeps each thread's state in its own
// checkpoint tables (created by a hand-written migration that mirrors its DDL); this table holds
// what LangGraph doesn't: who owns a thread, which agent it belongs to, and when it was last used,
// for ownership checks, thread lists, and retention.
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const agentThreads = pgTable(
  "agent_threads",
  {
    // The LangGraph thread id (from the AG-UI client; ownership is checked on every run).
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    agent: text("agent").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_threads_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("agent_threads_updated_at_idx").on(table.updatedAt),
  ],
);
