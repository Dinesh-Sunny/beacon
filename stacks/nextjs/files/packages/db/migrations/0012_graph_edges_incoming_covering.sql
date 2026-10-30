DROP INDEX "graph_edges_incoming_idx";--> statement-breakpoint
CREATE INDEX "graph_edges_incoming_idx" ON "graph_edges" USING btree ("dst_id","type","organization_id","src_id");