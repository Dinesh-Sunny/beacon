import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_tenants_shop_ships_to" AS ENUM('GB', 'IE', 'FR', 'DE', 'NL', 'ES', 'IT', 'US', 'CA', 'AU');
  CREATE TYPE "payload"."enum_tenants_shop_currency" AS ENUM('GBP', 'EUR', 'USD');
  CREATE TYPE "payload"."enum_addresses_country" AS ENUM('US', 'GB', 'CA', 'AU', 'AT', 'BE', 'BR', 'BG', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HK', 'HU', 'IN', 'IE', 'IT', 'JP', 'LV', 'LT', 'LU', 'MY', 'MT', 'MX', 'NL', 'NZ', 'NO', 'PL', 'PT', 'RO', 'SG', 'SK', 'SI', 'ES', 'SE', 'CH');
  CREATE TYPE "payload"."enum_variants_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__variants_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__products_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_carts_currency" AS ENUM('GBP', 'EUR', 'USD');
  CREATE TYPE "payload"."enum_orders_status" AS ENUM('processing', 'completed', 'cancelled', 'refunded');
  CREATE TYPE "payload"."enum_orders_currency" AS ENUM('GBP', 'EUR', 'USD');
  CREATE TYPE "payload"."enum_transactions_payment_method" AS ENUM('stripe-checkout');
  CREATE TYPE "payload"."enum_transactions_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded');
  CREATE TYPE "payload"."enum_transactions_currency" AS ENUM('GBP', 'EUR', 'USD');
  CREATE TABLE "payload"."tenants_shop_ships_to" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "payload"."enum_tenants_shop_ships_to",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "payload"."tenants_shop_shipping_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"amount" numeric NOT NULL
  );
  
  CREATE TABLE "payload"."customers" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"better_auth_user_id" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."addresses" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"customer_id" uuid,
  	"title" varchar,
  	"first_name" varchar,
  	"last_name" varchar,
  	"company" varchar,
  	"address_line1" varchar,
  	"address_line2" varchar,
  	"city" varchar,
  	"state" varchar,
  	"postal_code" varchar,
  	"country" "payload"."enum_addresses_country" NOT NULL,
  	"phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."variants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"title" varchar,
  	"product_id" uuid,
  	"inventory" numeric DEFAULT 0,
  	"price_in_g_b_p_enabled" boolean,
  	"price_in_g_b_p" numeric,
  	"price_in_e_u_r_enabled" boolean,
  	"price_in_e_u_r" numeric,
  	"price_in_u_s_d_enabled" boolean,
  	"price_in_u_s_d" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "payload"."enum_variants_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."variants_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"variant_options_id" uuid
  );
  
  CREATE TABLE "payload"."_variants_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_tenant_id" uuid,
  	"version_title" varchar,
  	"version_product_id" uuid,
  	"version_inventory" numeric DEFAULT 0,
  	"version_price_in_g_b_p_enabled" boolean,
  	"version_price_in_g_b_p" numeric,
  	"version_price_in_e_u_r_enabled" boolean,
  	"version_price_in_e_u_r" numeric,
  	"version_price_in_u_s_d_enabled" boolean,
  	"version_price_in_u_s_d" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__variants_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_variants_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"variant_options_id" uuid
  );
  
  CREATE TABLE "payload"."variant_types" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"label" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."variant_options" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_variantoptions_options_order" varchar,
  	"tenant_id" uuid,
  	"variant_type_id" uuid NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."products" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"inventory" numeric DEFAULT 0,
  	"enable_variants" boolean,
  	"price_in_g_b_p_enabled" boolean,
  	"price_in_g_b_p" numeric,
  	"price_in_e_u_r_enabled" boolean,
  	"price_in_e_u_r" numeric,
  	"price_in_u_s_d_enabled" boolean,
  	"price_in_u_s_d" numeric,
  	"requires_shipping" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "payload"."enum_products_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" uuid,
  	"variant_types_id" uuid
  );
  
  CREATE TABLE "payload"."_products_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_tenant_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_inventory" numeric DEFAULT 0,
  	"version_enable_variants" boolean,
  	"version_price_in_g_b_p_enabled" boolean,
  	"version_price_in_g_b_p" numeric,
  	"version_price_in_e_u_r_enabled" boolean,
  	"version_price_in_e_u_r" numeric,
  	"version_price_in_u_s_d_enabled" boolean,
  	"version_price_in_u_s_d" numeric,
  	"version_requires_shipping" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__products_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" uuid,
  	"variant_types_id" uuid
  );
  
  CREATE TABLE "payload"."carts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" uuid,
  	"variant_id" uuid,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "payload"."carts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"secret" varchar,
  	"customer_id" uuid,
  	"purchased_at" timestamp(3) with time zone,
  	"subtotal" numeric,
  	"currency" "payload"."enum_carts_currency" DEFAULT 'GBP',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" uuid,
  	"variant_id" uuid,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "payload"."orders" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"shipping_address_title" varchar,
  	"shipping_address_first_name" varchar,
  	"shipping_address_last_name" varchar,
  	"shipping_address_company" varchar,
  	"shipping_address_address_line1" varchar,
  	"shipping_address_address_line2" varchar,
  	"shipping_address_city" varchar,
  	"shipping_address_state" varchar,
  	"shipping_address_postal_code" varchar,
  	"shipping_address_country" varchar,
  	"shipping_address_phone" varchar,
  	"customer_id" uuid,
  	"customer_email" varchar,
  	"status" "payload"."enum_orders_status" DEFAULT 'processing',
  	"amount" numeric,
  	"currency" "payload"."enum_orders_currency" DEFAULT 'GBP',
  	"shipping_name" varchar,
  	"shipping_line1" varchar,
  	"shipping_line2" varchar,
  	"shipping_city" varchar,
  	"shipping_postal_code" varchar,
  	"shipping_country" varchar,
  	"shipping_rate" varchar,
  	"needs_review" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."orders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"transactions_id" uuid
  );
  
  CREATE TABLE "payload"."transactions_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" uuid,
  	"variant_id" uuid,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "payload"."transactions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"payment_method" "payload"."enum_transactions_payment_method",
  	"stripe_checkout_checkout_session_i_d" varchar,
  	"stripe_checkout_payment_intent_i_d" varchar,
  	"billing_address_title" varchar,
  	"billing_address_first_name" varchar,
  	"billing_address_last_name" varchar,
  	"billing_address_company" varchar,
  	"billing_address_address_line1" varchar,
  	"billing_address_address_line2" varchar,
  	"billing_address_city" varchar,
  	"billing_address_state" varchar,
  	"billing_address_postal_code" varchar,
  	"billing_address_country" varchar,
  	"billing_address_phone" varchar,
  	"status" "payload"."enum_transactions_status" DEFAULT 'pending' NOT NULL,
  	"customer_id" uuid,
  	"customer_email" varchar,
  	"order_id" uuid,
  	"cart_id" uuid,
  	"amount" numeric,
  	"currency" "payload"."enum_transactions_currency" DEFAULT 'GBP',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."tenants" ADD COLUMN "shop_currency" "payload"."enum_tenants_shop_currency" DEFAULT 'GBP' NOT NULL;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "customers_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "addresses_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "variants_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "variant_types_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "variant_options_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "products_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "carts_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "orders_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "transactions_id" uuid;
  ALTER TABLE "payload"."tenants_shop_ships_to" ADD CONSTRAINT "tenants_shop_ships_to_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."tenants_shop_shipping_rates" ADD CONSTRAINT "tenants_shop_shipping_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."variants" ADD CONSTRAINT "variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."variants_rels" ADD CONSTRAINT "variants_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."variants_rels" ADD CONSTRAINT "variants_rels_variant_options_fk" FOREIGN KEY ("variant_options_id") REFERENCES "payload"."variant_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_variants_v" ADD CONSTRAINT "_variants_v_parent_id_variants_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_variants_v" ADD CONSTRAINT "_variants_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_variants_v" ADD CONSTRAINT "_variants_v_version_product_id_products_id_fk" FOREIGN KEY ("version_product_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_variants_v_rels" ADD CONSTRAINT "_variants_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_variants_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_variants_v_rels" ADD CONSTRAINT "_variants_v_rels_variant_options_fk" FOREIGN KEY ("variant_options_id") REFERENCES "payload"."variant_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."variant_types" ADD CONSTRAINT "variant_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."variant_options" ADD CONSTRAINT "variant_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."variant_options" ADD CONSTRAINT "variant_options_variant_type_id_variant_types_id_fk" FOREIGN KEY ("variant_type_id") REFERENCES "payload"."variant_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."products_rels" ADD CONSTRAINT "products_rels_variant_types_fk" FOREIGN KEY ("variant_types_id") REFERENCES "payload"."variant_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_products_v" ADD CONSTRAINT "_products_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_products_v_rels" ADD CONSTRAINT "_products_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_products_v_rels" ADD CONSTRAINT "_products_v_rels_variant_types_fk" FOREIGN KEY ("variant_types_id") REFERENCES "payload"."variant_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."carts_items" ADD CONSTRAINT "carts_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."carts_items" ADD CONSTRAINT "carts_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "payload"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."carts_items" ADD CONSTRAINT "carts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."carts" ADD CONSTRAINT "carts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."carts" ADD CONSTRAINT "carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."orders_items" ADD CONSTRAINT "orders_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "payload"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."orders_rels" ADD CONSTRAINT "orders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."orders_rels" ADD CONSTRAINT "orders_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "payload"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."transactions_items" ADD CONSTRAINT "transactions_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."transactions_items" ADD CONSTRAINT "transactions_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "payload"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."transactions_items" ADD CONSTRAINT "transactions_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."transactions" ADD CONSTRAINT "transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payload"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."transactions" ADD CONSTRAINT "transactions_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "payload"."carts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenants_shop_ships_to_order_idx" ON "payload"."tenants_shop_ships_to" USING btree ("order");
  CREATE INDEX "tenants_shop_ships_to_parent_idx" ON "payload"."tenants_shop_ships_to" USING btree ("parent_id");
  CREATE INDEX "tenants_shop_shipping_rates_order_idx" ON "payload"."tenants_shop_shipping_rates" USING btree ("_order");
  CREATE INDEX "tenants_shop_shipping_rates_parent_id_idx" ON "payload"."tenants_shop_shipping_rates" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customers_better_auth_user_id_idx" ON "payload"."customers" USING btree ("better_auth_user_id");
  CREATE INDEX "customers_updated_at_idx" ON "payload"."customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "payload"."customers" USING btree ("created_at");
  CREATE INDEX "addresses_customer_idx" ON "payload"."addresses" USING btree ("customer_id");
  CREATE INDEX "addresses_updated_at_idx" ON "payload"."addresses" USING btree ("updated_at");
  CREATE INDEX "addresses_created_at_idx" ON "payload"."addresses" USING btree ("created_at");
  CREATE INDEX "variants_tenant_idx" ON "payload"."variants" USING btree ("tenant_id");
  CREATE INDEX "variants_product_idx" ON "payload"."variants" USING btree ("product_id");
  CREATE INDEX "variants_updated_at_idx" ON "payload"."variants" USING btree ("updated_at");
  CREATE INDEX "variants_created_at_idx" ON "payload"."variants" USING btree ("created_at");
  CREATE INDEX "variants_deleted_at_idx" ON "payload"."variants" USING btree ("deleted_at");
  CREATE INDEX "variants__status_idx" ON "payload"."variants" USING btree ("_status");
  CREATE INDEX "variants_rels_order_idx" ON "payload"."variants_rels" USING btree ("order");
  CREATE INDEX "variants_rels_parent_idx" ON "payload"."variants_rels" USING btree ("parent_id");
  CREATE INDEX "variants_rels_path_idx" ON "payload"."variants_rels" USING btree ("path");
  CREATE INDEX "variants_rels_variant_options_id_idx" ON "payload"."variants_rels" USING btree ("variant_options_id");
  CREATE INDEX "_variants_v_parent_idx" ON "payload"."_variants_v" USING btree ("parent_id");
  CREATE INDEX "_variants_v_version_version_tenant_idx" ON "payload"."_variants_v" USING btree ("version_tenant_id");
  CREATE INDEX "_variants_v_version_version_product_idx" ON "payload"."_variants_v" USING btree ("version_product_id");
  CREATE INDEX "_variants_v_version_version_updated_at_idx" ON "payload"."_variants_v" USING btree ("version_updated_at");
  CREATE INDEX "_variants_v_version_version_created_at_idx" ON "payload"."_variants_v" USING btree ("version_created_at");
  CREATE INDEX "_variants_v_version_version_deleted_at_idx" ON "payload"."_variants_v" USING btree ("version_deleted_at");
  CREATE INDEX "_variants_v_version_version__status_idx" ON "payload"."_variants_v" USING btree ("version__status");
  CREATE INDEX "_variants_v_created_at_idx" ON "payload"."_variants_v" USING btree ("created_at");
  CREATE INDEX "_variants_v_updated_at_idx" ON "payload"."_variants_v" USING btree ("updated_at");
  CREATE INDEX "_variants_v_latest_idx" ON "payload"."_variants_v" USING btree ("latest");
  CREATE INDEX "_variants_v_autosave_idx" ON "payload"."_variants_v" USING btree ("autosave");
  CREATE INDEX "_variants_v_rels_order_idx" ON "payload"."_variants_v_rels" USING btree ("order");
  CREATE INDEX "_variants_v_rels_parent_idx" ON "payload"."_variants_v_rels" USING btree ("parent_id");
  CREATE INDEX "_variants_v_rels_path_idx" ON "payload"."_variants_v_rels" USING btree ("path");
  CREATE INDEX "_variants_v_rels_variant_options_id_idx" ON "payload"."_variants_v_rels" USING btree ("variant_options_id");
  CREATE INDEX "variant_types_tenant_idx" ON "payload"."variant_types" USING btree ("tenant_id");
  CREATE INDEX "variant_types_updated_at_idx" ON "payload"."variant_types" USING btree ("updated_at");
  CREATE INDEX "variant_types_created_at_idx" ON "payload"."variant_types" USING btree ("created_at");
  CREATE INDEX "variant_types_deleted_at_idx" ON "payload"."variant_types" USING btree ("deleted_at");
  CREATE INDEX "variant_options__variantoptions_options_order_idx" ON "payload"."variant_options" USING btree ("_variantoptions_options_order");
  CREATE INDEX "variant_options_tenant_idx" ON "payload"."variant_options" USING btree ("tenant_id");
  CREATE INDEX "variant_options_variant_type_idx" ON "payload"."variant_options" USING btree ("variant_type_id");
  CREATE INDEX "variant_options_updated_at_idx" ON "payload"."variant_options" USING btree ("updated_at");
  CREATE INDEX "variant_options_created_at_idx" ON "payload"."variant_options" USING btree ("created_at");
  CREATE INDEX "variant_options_deleted_at_idx" ON "payload"."variant_options" USING btree ("deleted_at");
  CREATE INDEX "products_tenant_idx" ON "payload"."products" USING btree ("tenant_id");
  CREATE INDEX "products_slug_idx" ON "payload"."products" USING btree ("slug");
  CREATE INDEX "products_updated_at_idx" ON "payload"."products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "payload"."products" USING btree ("created_at");
  CREATE INDEX "products_deleted_at_idx" ON "payload"."products" USING btree ("deleted_at");
  CREATE INDEX "products__status_idx" ON "payload"."products" USING btree ("_status");
  CREATE UNIQUE INDEX "tenant_slug_1_idx" ON "payload"."products" USING btree ("tenant_id","slug");
  CREATE INDEX "products_rels_order_idx" ON "payload"."products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "payload"."products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "payload"."products_rels" USING btree ("path");
  CREATE INDEX "products_rels_media_id_idx" ON "payload"."products_rels" USING btree ("media_id");
  CREATE INDEX "products_rels_variant_types_id_idx" ON "payload"."products_rels" USING btree ("variant_types_id");
  CREATE INDEX "_products_v_parent_idx" ON "payload"."_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_tenant_idx" ON "payload"."_products_v" USING btree ("version_tenant_id");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "payload"."_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "payload"."_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "payload"."_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_version_version_deleted_at_idx" ON "payload"."_products_v" USING btree ("version_deleted_at");
  CREATE INDEX "_products_v_version_version__status_idx" ON "payload"."_products_v" USING btree ("version__status");
  CREATE INDEX "_products_v_created_at_idx" ON "payload"."_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "payload"."_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_latest_idx" ON "payload"."_products_v" USING btree ("latest");
  CREATE INDEX "_products_v_autosave_idx" ON "payload"."_products_v" USING btree ("autosave");
  CREATE INDEX "version_tenant_version_slug_1_idx" ON "payload"."_products_v" USING btree ("version_tenant_id","version_slug");
  CREATE INDEX "_products_v_rels_order_idx" ON "payload"."_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "payload"."_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "payload"."_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_media_id_idx" ON "payload"."_products_v_rels" USING btree ("media_id");
  CREATE INDEX "_products_v_rels_variant_types_id_idx" ON "payload"."_products_v_rels" USING btree ("variant_types_id");
  CREATE INDEX "carts_items_order_idx" ON "payload"."carts_items" USING btree ("_order");
  CREATE INDEX "carts_items_parent_id_idx" ON "payload"."carts_items" USING btree ("_parent_id");
  CREATE INDEX "carts_items_product_idx" ON "payload"."carts_items" USING btree ("product_id");
  CREATE INDEX "carts_items_variant_idx" ON "payload"."carts_items" USING btree ("variant_id");
  CREATE INDEX "carts_tenant_idx" ON "payload"."carts" USING btree ("tenant_id");
  CREATE INDEX "carts_secret_idx" ON "payload"."carts" USING btree ("secret");
  CREATE INDEX "carts_customer_idx" ON "payload"."carts" USING btree ("customer_id");
  CREATE INDEX "carts_updated_at_idx" ON "payload"."carts" USING btree ("updated_at");
  CREATE INDEX "carts_created_at_idx" ON "payload"."carts" USING btree ("created_at");
  CREATE INDEX "orders_items_order_idx" ON "payload"."orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "payload"."orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "payload"."orders_items" USING btree ("product_id");
  CREATE INDEX "orders_items_variant_idx" ON "payload"."orders_items" USING btree ("variant_id");
  CREATE INDEX "orders_tenant_idx" ON "payload"."orders" USING btree ("tenant_id");
  CREATE INDEX "orders_customer_idx" ON "payload"."orders" USING btree ("customer_id");
  CREATE INDEX "orders_updated_at_idx" ON "payload"."orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "payload"."orders" USING btree ("created_at");
  CREATE INDEX "orders_rels_order_idx" ON "payload"."orders_rels" USING btree ("order");
  CREATE INDEX "orders_rels_parent_idx" ON "payload"."orders_rels" USING btree ("parent_id");
  CREATE INDEX "orders_rels_path_idx" ON "payload"."orders_rels" USING btree ("path");
  CREATE INDEX "orders_rels_transactions_id_idx" ON "payload"."orders_rels" USING btree ("transactions_id");
  CREATE INDEX "transactions_items_order_idx" ON "payload"."transactions_items" USING btree ("_order");
  CREATE INDEX "transactions_items_parent_id_idx" ON "payload"."transactions_items" USING btree ("_parent_id");
  CREATE INDEX "transactions_items_product_idx" ON "payload"."transactions_items" USING btree ("product_id");
  CREATE INDEX "transactions_items_variant_idx" ON "payload"."transactions_items" USING btree ("variant_id");
  CREATE INDEX "transactions_tenant_idx" ON "payload"."transactions" USING btree ("tenant_id");
  CREATE INDEX "transactions_stripe_checkout_stripe_checkout_checkout_se_idx" ON "payload"."transactions" USING btree ("stripe_checkout_checkout_session_i_d");
  CREATE INDEX "transactions_stripe_checkout_stripe_checkout_payment_int_idx" ON "payload"."transactions" USING btree ("stripe_checkout_payment_intent_i_d");
  CREATE INDEX "transactions_customer_idx" ON "payload"."transactions" USING btree ("customer_id");
  CREATE INDEX "transactions_order_idx" ON "payload"."transactions" USING btree ("order_id");
  CREATE INDEX "transactions_cart_idx" ON "payload"."transactions" USING btree ("cart_id");
  CREATE INDEX "transactions_updated_at_idx" ON "payload"."transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "payload"."transactions" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "payload"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_addresses_fk" FOREIGN KEY ("addresses_id") REFERENCES "payload"."addresses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_variants_fk" FOREIGN KEY ("variants_id") REFERENCES "payload"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_variant_types_fk" FOREIGN KEY ("variant_types_id") REFERENCES "payload"."variant_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_variant_options_fk" FOREIGN KEY ("variant_options_id") REFERENCES "payload"."variant_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "payload"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_carts_fk" FOREIGN KEY ("carts_id") REFERENCES "payload"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "payload"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "payload"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_addresses_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("addresses_id");
  CREATE INDEX "payload_locked_documents_rels_variants_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("variants_id");
  CREATE INDEX "payload_locked_documents_rels_variant_types_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("variant_types_id");
  CREATE INDEX "payload_locked_documents_rels_variant_options_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("variant_options_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_carts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("carts_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("transactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tenants_shop_ships_to" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."tenants_shop_shipping_rates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."addresses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."variants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."variants_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_variants_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_variants_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."variant_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."variant_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_products_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_products_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."carts_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."carts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."orders_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."orders_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."transactions_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."tenants_shop_ships_to" CASCADE;
  DROP TABLE "payload"."tenants_shop_shipping_rates" CASCADE;
  DROP TABLE "payload"."customers" CASCADE;
  DROP TABLE "payload"."addresses" CASCADE;
  DROP TABLE "payload"."variants" CASCADE;
  DROP TABLE "payload"."variants_rels" CASCADE;
  DROP TABLE "payload"."_variants_v" CASCADE;
  DROP TABLE "payload"."_variants_v_rels" CASCADE;
  DROP TABLE "payload"."variant_types" CASCADE;
  DROP TABLE "payload"."variant_options" CASCADE;
  DROP TABLE "payload"."products" CASCADE;
  DROP TABLE "payload"."products_rels" CASCADE;
  DROP TABLE "payload"."_products_v" CASCADE;
  DROP TABLE "payload"."_products_v_rels" CASCADE;
  DROP TABLE "payload"."carts_items" CASCADE;
  DROP TABLE "payload"."carts" CASCADE;
  DROP TABLE "payload"."orders_items" CASCADE;
  DROP TABLE "payload"."orders" CASCADE;
  DROP TABLE "payload"."orders_rels" CASCADE;
  DROP TABLE "payload"."transactions_items" CASCADE;
  DROP TABLE "payload"."transactions" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_addresses_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_variants_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_variant_types_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_variant_options_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_carts_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_customers_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_addresses_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_variants_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_variant_types_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_variant_options_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_carts_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_transactions_id_idx";
  ALTER TABLE "payload"."tenants" DROP COLUMN "shop_currency";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "customers_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "addresses_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "variants_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "variant_types_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "variant_options_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "carts_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "transactions_id";
  DROP TYPE "payload"."enum_tenants_shop_ships_to";
  DROP TYPE "payload"."enum_tenants_shop_currency";
  DROP TYPE "payload"."enum_addresses_country";
  DROP TYPE "payload"."enum_variants_status";
  DROP TYPE "payload"."enum__variants_v_version_status";
  DROP TYPE "payload"."enum_products_status";
  DROP TYPE "payload"."enum__products_v_version_status";
  DROP TYPE "payload"."enum_carts_currency";
  DROP TYPE "payload"."enum_orders_status";
  DROP TYPE "payload"."enum_orders_currency";
  DROP TYPE "payload"."enum_transactions_payment_method";
  DROP TYPE "payload"."enum_transactions_status";
  DROP TYPE "payload"."enum_transactions_currency";`)
}
