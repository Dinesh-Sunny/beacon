CREATE TABLE "graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"src_kind" text NOT NULL,
	"src_id" uuid NOT NULL,
	"type" text NOT NULL,
	"dst_kind" text NOT NULL,
	"dst_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graph_edges_unique" UNIQUE("src_id","type","organization_id","dst_id"),
	CONSTRAINT "graph_edges_no_self_loop" CHECK ("graph_edges"."src_id" <> "graph_edges"."dst_id")
);
--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graph_edges_incoming_idx" ON "graph_edges" USING btree ("dst_id","type","organization_id");--> statement-breakpoint
CREATE INDEX "graph_edges_organization_id_idx" ON "graph_edges" USING btree ("organization_id");