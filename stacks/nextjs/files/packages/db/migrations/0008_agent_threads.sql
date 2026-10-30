CREATE TABLE "agent_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agent" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_threads_user_id_updated_at_idx" ON "agent_threads" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_threads_updated_at_idx" ON "agent_threads" USING btree ("updated_at");