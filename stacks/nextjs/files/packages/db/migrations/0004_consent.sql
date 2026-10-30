CREATE SCHEMA "consent";
--> statement-breakpoint
CREATE TABLE "consent"."auditLog" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"actionType" text NOT NULL,
	"subjectId" text,
	"ipAddress" text,
	"userAgent" text,
	"changes" json,
	"metadata" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"tenantId" text
);
--> statement-breakpoint
CREATE TABLE "consent"."consent" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"subjectId" text NOT NULL,
	"domainId" text NOT NULL,
	"policyId" text,
	"purposeIds" json NOT NULL,
	"metadata" json,
	"ipAddress" text,
	"userAgent" text,
	"givenAt" timestamp with time zone DEFAULT now() NOT NULL,
	"validUntil" timestamp with time zone,
	"jurisdiction" text,
	"jurisdictionModel" text,
	"tcString" text,
	"uiSource" text,
	"consentAction" text,
	"runtimePolicyDecisionId" text,
	"runtimePolicySource" text,
	"tenantId" text
);
--> statement-breakpoint
CREATE TABLE "consent"."consentPolicy" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"type" text NOT NULL,
	"hash" text,
	"effectiveDate" timestamp with time zone NOT NULL,
	"isActive" boolean NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"tenantId" text
);
--> statement-breakpoint
CREATE TABLE "consent"."consentPurpose" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"tenantId" text
);
--> statement-breakpoint
CREATE TABLE "consent"."domain" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"tenantId" text
);
--> statement-breakpoint
CREATE TABLE "consent"."private_c15t_settings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" varchar(255) DEFAULT '2.0.0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent"."runtimePolicyDecision" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tenantId" text,
	"policyId" text NOT NULL,
	"fingerprint" text NOT NULL,
	"matchedBy" text NOT NULL,
	"countryCode" text,
	"regionCode" text,
	"jurisdiction" text NOT NULL,
	"language" text,
	"model" text NOT NULL,
	"policyI18n" json,
	"uiMode" text,
	"bannerUi" json,
	"dialogUi" json,
	"categories" json,
	"preselectedCategories" json,
	"proofConfig" json,
	"dedupeKey" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtimePolicyDecision_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "consent"."subject" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"externalId" text,
	"identityProvider" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"tenantId" text
);
--> statement-breakpoint
ALTER TABLE "consent"."auditLog" ADD CONSTRAINT "auditLog_subject_subject_fk" FOREIGN KEY ("subjectId") REFERENCES "consent"."subject"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "consent"."consent" ADD CONSTRAINT "consent_subject_subject_fk" FOREIGN KEY ("subjectId") REFERENCES "consent"."subject"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "consent"."consent" ADD CONSTRAINT "consent_domain_domain_fk" FOREIGN KEY ("domainId") REFERENCES "consent"."domain"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "consent"."consent" ADD CONSTRAINT "consent_consentPolicy_policy_fk" FOREIGN KEY ("policyId") REFERENCES "consent"."consentPolicy"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "consent"."consent" ADD CONSTRAINT "consent_runtimePolicyDecision_runtimePolicyDecision_fk" FOREIGN KEY ("runtimePolicyDecisionId") REFERENCES "consent"."runtimePolicyDecision"("id") ON DELETE restrict ON UPDATE restrict;