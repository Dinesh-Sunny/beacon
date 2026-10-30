<!-- last-verified: 2026-10-03 -->
# Document data on Postgres

How to get NoSQL-style flexibility (schemaless documents, key-value, containment and path queries) from the Postgres we already run, and when to reach for Upstash Redis or a queue instead. Read before adding a `jsonb` column, querying JSON, or choosing where flexible or ephemeral data lives.

## Decision

- Documents live in `jsonb` columns on ordinary tables: relational columns for identity, ownership, tenant, and anything joined or constrained; `jsonb` for sparse, nested, or per-tenant shapes.
- No document database and no MongoDB layer. Only the core `jsonb` features plus `hstore`/`pg_trgm` are on local Docker, Neon, and PlanetScale alike.
- Ephemeral key-value, counters, leaderboards, and rate limits go to Upstash Redis (`@__NAME__/ratelimit` already uses it). Work queues go to Payload jobs (docs/knowledge/jobs.md) or Vercel Queues.

## What our stack lacks (checked 2026-10-03)

| Feature | Status |
| --- | --- |
| MongoDB wire protocol (FerretDB 2 on the `documentdb` extension) | `documentdb` is on none of our three databases; FerretDB would need its own Postgres host |
| JSON Schema in the database (`pg_jsonschema`) | Neon only. Validate in app code and with `CHECK` constraints instead |
| `pgmq`, `pg_net`, `plv8`, `rum`, `pg_search`, `pg_ivm` | Missing on at least one provider (Neon rejects `plv8`; `pg_ivm` closed to new installs) |
| LISTEN/NOTIFY as pub/sub | Not through either pooler (transaction mode); direct URL only. Use Upstash pub/sub for realtime |
| UNLOGGED tables as a cache | Truncated after a crash; on Neon also lost on every compute restart or scale-to-zero. Don't use them |
| Virtual generated columns over jsonb | Postgres 18 refuses indexes and `UNIQUE` on them, and drizzle-kit 0.31 emits only `STORED` |
| Drizzle builders for `->`, `@>`, jsonpath | None in 0.45 (`arrayContains` is for Postgres arrays). Use the helpers below |

## Postgres features to use

| Feature | Since | Use |
| --- | --- | --- |
| `jsonb` containment `@>`, existence `?` `?|` `?&` | 9.4 | Filter by fragment or key; GIN-indexed |
| Subscripting `data['a']['b']`, `UPDATE ... SET data['k'] = '1'` | 14 | Read and patch one key without rewriting by hand |
| jsonpath `@?` `@@`, `jsonb_path_exists`, `jsonb_path_query`, `jsonb_path_query_first` (`lax` default, `strict`) | 12; `.datetime()` 13; `.integer()`, `.string()`… 17 | Conditions inside arrays and nested objects; `$variables` for user values |
| `IS JSON [OBJECT|ARRAY] [WITH UNIQUE KEYS]`, `JSON_OBJECT`, `JSON_ARRAYAGG`… | 16 | Validation in `CHECK`, building JSON in SQL |
| `JSON_VALUE`, `JSON_QUERY`, `JSON_EXISTS`, `JSON_TABLE` | 17 | Typed extraction; `JSON_TABLE` turns arrays into rows (bad values give NULL, a failing row path gives no rows) |
| `jsonb_set`, `jsonb_insert`, `||`, `-`, `#-` | 9.5 | Partial updates in one statement |
| `jsonb_strip_nulls(doc, strip_in_arrays)`; jsonb `null` casts to SQL NULL | 18 | Cleaning documents; no cast errors on null |
| Stored generated columns | 12 | Promote a hot key to a typed, indexable column |
| `INSERT ... ON CONFLICT`, `MERGE ... RETURNING`, `RETURNING OLD/NEW` | 9.5 / 17 / 18 | Upserts and change capture in one statement |
| `hstore` | contrib | Flat text key-value; prefer `jsonb` unless you need hstore's operators |

Postgres 19 (beta, not on our providers yet) adds jsonpath string methods (`lower()`, `replace()`, `split_part()`…), `IS JSON` on domains, `COPY ... (FORMAT json)`, lz4 as the default TOAST compression, and `json_array(query)` returning `[]` instead of NULL on no rows.

## Helpers in `@__NAME__/db`

`packages/db/src/json.ts`, tested in `json.test.ts` (including that GIN serves containment). Every value is bound, never spliced into SQL.

| Export | SQL | Index |
| --- | --- | --- |
| `jsonContains(col, value)` | `col @> $1::jsonb` | GIN (`jsonb_ops` or `jsonb_path_ops`) |
| `jsonHasKey(col, key)` | `col ? $1` | GIN `jsonb_ops` only |
| `jsonPathExists(col, path)` | `col @? $1::jsonpath` | GIN (either opclass) |
| `jsonPathExists(col, path, vars)` | `jsonb_path_exists(col, $1::jsonpath, $2::jsonb, true)` (silent, like `@?`) | none; filter by an indexed column first |
| `jsonText(col, ...keys)` | `col #>> $1::text[]` | B-tree expression index on the same path |
| `toJsonb(value)` | `$1::jsonb` | building block for other operators |

```ts
await db.select().from(products)
  .where(and(eq(products.organizationId, orgId), jsonContains(products.attributes, { color: "red" })));

// User input goes in vars, never in the path string.
jsonPathExists(products.attributes, "$.sizes[*] ? (@ == $size)", { size: input.size });
```

## Columns and indexes

- Use `jsonb`, never `json`: `json` keeps the raw text, can't be GIN-indexed, and is re-parsed on every read. (The generated c15t consent tables use `json`; they are only read whole.)
- Declare with a type and a default: `attributes: jsonb().$type<ProductAttributes>().default({}).notNull()`. `$type` is compile-time only.
- Containment and jsonpath filters: `index().using("gin", t.attributes.op("jsonb_path_ops"))`, smaller and more selective. Use the default `jsonb_ops` only if you need `?`, `?|`, `?&`. Tenant-scoped filters can share one index with `btree_gin` (migration 0013): `index().using("gin", t.organizationId, t.attributes.op("jsonb_path_ops"))`. `jsonb_path_ops` makes no index entries for empty structures like `{"a":{}}`, so containment searches for them scan the whole index.
- One hot key (sorting, ranges, joins, uniqueness): a stored generated column, `generatedAlwaysAs((): SQL => sql\`(${products.data}->>'sku')\`)`, with a B-tree index; or a B-tree expression index on `(data->>'sku')`. Queries must use the same expression to hit it.
- Indexing a whole jsonb with a B-tree only helps equality of entire documents.
- Build big GIN indexes outside migrations (no `CONCURRENTLY` inside them; docs/knowledge/database.md). Postgres 18 builds GIN in parallel.

## Validation

- Postgres has no built-in JSON Schema. Guard shape in two places: app code before writes, and cheap `CHECK` constraints for invariants that must never break, e.g. `CHECK (attributes IS JSON OBJECT)`, `CHECK (jsonb_typeof(attributes->'price') = 'number')`.
- TypeScript has no schema library in the repo yet (`.claude/rules/security.md`): ask before adding one. Python uses Pydantic.

## Pitfalls

- Drizzle's column encoder `JSON.stringify`s values, so writing a pre-stringified string stores a JSON string, not an object.
- In raw `sql`, node-postgres binds a JS array as a Postgres array and a JS object as JSON. Use `toJsonb()`; and for `text[]` parameters use `sql.param(array)`, since a bare array in a `sql` template expands to `($1, $2)`.
- psycopg 3 doesn't adapt dicts: wrap with `Jsonb(obj)` (LangGraph's saver does its own).
- Payload `json`, `richText` (and blocks with `blocksAsJSON`) are `jsonb`. Payload interpolates json-field query values into SQL after a strict character check: keep those queries to trusted values.
- Updating any key rewrites and locks the whole row. Values over ~2 kB are TOASTed (pglz in Postgres 18; up to 1 GB). Split documents that grow without bound or update hot keys often.
- `COMPRESSION lz4` per column works locally but isn't documented by Neon or PlanetScale; check before relying on it.

## Where the template uses it

| Need | Store | Shape |
| --- | --- | --- |
| Agent state | `checkpoint*` tables (LangGraph, `jsonb`) | docs/knowledge/ai.md |
| Graph edge properties | `graph_edges.props` | docs/knowledge/graph.md |
| Product attributes, variants, tenant settings and theme tokens | Payload `json` fields (planned) | GIN `jsonb_path_ops` when filtered |
| Audit events, outbound webhook payloads, attribution (UTM, click ids) | `jsonb` payload column beside relational keys (planned) | Append-only; index the keys, not the payload |
| Idempotency keys with stored responses | `jsonb` response + unique key, TTL by cron (planned) | Postgres, so it survives with the write it guards |
| Rate limits, leaderboards, presence, short-lived cache | Upstash Redis | Not Postgres |
| Background work | Payload jobs; Vercel Queues for high volume | Not LISTEN/NOTIFY |

## Sources

- Postgres 18: [JSON types](https://www.postgresql.org/docs/18/datatype-json.html), [JSON functions](https://www.postgresql.org/docs/18/functions-json.html), [GIN](https://www.postgresql.org/docs/18/gin.html), [generated columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html), [TOAST](https://www.postgresql.org/docs/18/storage-toast.html), [NOTIFY](https://www.postgresql.org/docs/18/sql-notify.html), [hstore](https://www.postgresql.org/docs/18/hstore.html); [Postgres 19 notes](https://www.postgresql.org/docs/19/release-19.html)
- Providers: [Neon extensions](https://neon.com/docs/extensions/pg-extensions), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [Neon compatibility](https://neon.com/docs/reference/compatibility), [PlanetScale extensions](https://planetscale.com/docs/postgres/extensions), [PlanetScale PgBouncer](https://planetscale.com/docs/postgres/connecting/pgbouncer)
- Libraries: [Drizzle column types](https://orm.drizzle.team/docs/column-types/pg), [node-postgres queries](https://node-postgres.com/features/queries), [psycopg adaptation](https://www.psycopg.org/psycopg3/docs/basic/adapt.html), [Payload Postgres](https://payloadcms.com/docs/database/postgres), [FerretDB](https://docs.ferretdb.io/)
