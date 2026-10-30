// jsonb query helpers (docs/knowledge/document-data.md). Drizzle 0.45 has no builders for jsonb
// operators, and node-postgres binds a JS array as a Postgres array, not JSON. So every value here is
// JSON.stringify'd and cast to jsonb, and every helper returns SQL for `.where()` with bound values.
import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// A JS value bound as jsonb (arrays stay JSON arrays).
export function toJsonb(value: JsonValue): SQL {
  return sql`${JSON.stringify(value)}::jsonb`;
}

// column @> value: the document contains this fragment. GIN-indexed by jsonb_ops and jsonb_path_ops.
export function jsonContains(column: PgColumn, value: JsonValue): SQL {
  return sql`${column} @> ${toJsonb(value)}`;
}

// column ? key: a top-level key (or array string element) exists. GIN-indexed by jsonb_ops only.
export function jsonHasKey(column: PgColumn, key: string): SQL {
  return sql`${column} ? ${key}`;
}

// jsonpath test. Without `vars` it uses `@?`, which GIN can serve. With `vars`, user values travel
// as $variables (e.g. path '$.tags[*] ? (@ == $tag)', vars { tag }) through jsonb_path_exists,
// which no index serves. Never interpolate user input into `path` itself.
export function jsonPathExists(
  column: PgColumn,
  path: string,
  vars?: Record<string, JsonValue>,
): SQL {
  if (vars === undefined) return sql`${column} @? ${path}::jsonpath`;
  // silent = true matches `@?`: a document the path can't evaluate (wrong type, missing key in
  // strict mode) doesn't match, instead of failing the whole query.
  return sql`jsonb_path_exists(${column}, ${path}::jsonpath, ${toJsonb(vars)}, true)`;
}

// column #>> path: the value at a key path as text (NULL when missing). For sorting, display, or a
// B-tree expression index on the same path. sql.param binds the path as one text[]; a bare array
// in a sql template would expand into a list.
export function jsonText(
  column: PgColumn,
  ...path: readonly string[]
): SQL<string | null> {
  return sql<string | null>`${column} #>> ${sql.param([...path])}::text[]`;
}
