-- Extensions the template relies on; all three exist on Neon, PlanetScale, and the local image.
-- PlanetScale: enable each one in the dashboard (Extensions) first if this fails on permissions.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
