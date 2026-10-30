-- c15t's v2 schema ships without indexes. The public consent API looks rows up by these columns,
-- so without them each request scans a table that grows with every visitor. Hand-written because
-- packages/db/src/schema/consent.ts is generated from c15t and can't carry indexes.
CREATE INDEX "consent_subjectId_idx" ON "consent"."consent" USING btree ("subjectId");--> statement-breakpoint
CREATE INDEX "subject_externalId_idx" ON "consent"."subject" USING btree ("externalId");--> statement-breakpoint
CREATE INDEX "auditLog_subjectId_idx" ON "consent"."auditLog" USING btree ("subjectId");--> statement-breakpoint
CREATE INDEX "domain_name_idx" ON "consent"."domain" USING btree ("name");--> statement-breakpoint
CREATE INDEX "consentPurpose_code_idx" ON "consent"."consentPurpose" USING btree ("code");
