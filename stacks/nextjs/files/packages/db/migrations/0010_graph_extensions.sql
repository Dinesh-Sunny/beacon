-- Graph and tree support (docs/knowledge/graph.md). Both ship with Postgres and install with plain
-- CREATE EXTENSION on Neon and PlanetScale (no superuser, no restart).
-- ltree: materialized-path trees (categories, threads, org charts) with GiST-indexed subtree queries.
CREATE EXTENSION IF NOT EXISTS ltree;--> statement-breakpoint
-- btree_gist: lets uuid/text columns sit beside a range in WITHOUT OVERLAPS keys (time-ranged edges).
CREATE EXTENSION IF NOT EXISTS btree_gist;
