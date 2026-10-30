import { getDb } from "@__NAME__/db";

// Shop data after an account is deleted (docs/adr/0003-commerce.md). Orders and transactions are
// kept for tax records (UK VAT: 6 years) but no longer name the person: customer link and email
// cleared, addresses reduced to the country. The customer link and its open carts are deleted.
// Matches orders placed signed in (customer link) and as a guest with the account's email. Safe
// to run twice. Relative imports only, so `node --test` runs it.

const SCHEMA = "payload";

export type ShopEraseResult = { orders: number; customers: number };

const ORDER_PERSONAL_COLUMNS = [
  "customer_id",
  "customer_email",
  "shipping_name",
  "shipping_line1",
  "shipping_line2",
  "shipping_city",
  "shipping_postal_code",
  "shipping_address_title",
  "shipping_address_first_name",
  "shipping_address_last_name",
  "shipping_address_company",
  "shipping_address_address_line1",
  "shipping_address_address_line2",
  "shipping_address_city",
  "shipping_address_state",
  "shipping_address_postal_code",
  "shipping_address_phone",
] as const;

const TRANSACTION_PERSONAL_COLUMNS = [
  "customer_id",
  "customer_email",
  "billing_address_title",
  "billing_address_first_name",
  "billing_address_last_name",
  "billing_address_company",
  "billing_address_address_line1",
  "billing_address_address_line2",
  "billing_address_city",
  "billing_address_state",
  "billing_address_postal_code",
  "billing_address_phone",
] as const;

function nulls(columns: readonly string[]): string {
  return columns.map((column) => `"${column}" = null`).join(", ");
}

export async function eraseShopData(
  userId: string,
  email: string | null,
): Promise<ShopEraseResult> {
  const client = await getDb().$client.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(
      `select id from ${SCHEMA}.customers where better_auth_user_id = $1`,
      [userId],
    );
    const customerIds = rows.map((row) => row.id);
    const match = `(customer_id = any($1::uuid[]) or ($2::text is not null and lower(customer_email) = lower($2)))`;
    const orders = await client.query(
      `update ${SCHEMA}.orders set ${nulls(ORDER_PERSONAL_COLUMNS)} where ${match}`,
      [customerIds, email],
    );
    await client.query(
      `update ${SCHEMA}.transactions set ${nulls(TRANSACTION_PERSONAL_COLUMNS)} where ${match}`,
      [customerIds, email],
    );
    await client.query(
      `delete from ${SCHEMA}.carts where customer_id = any($1::uuid[]) and purchased_at is null`,
      [customerIds],
    );
    await client.query(
      `update ${SCHEMA}.carts set customer_id = null where customer_id = any($1::uuid[])`,
      [customerIds],
    );
    await client.query(
      `delete from ${SCHEMA}.customers where id = any($1::uuid[])`,
      [customerIds],
    );
    await client.query("commit");
    return { orders: orders.rowCount ?? 0, customers: customerIds.length };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
