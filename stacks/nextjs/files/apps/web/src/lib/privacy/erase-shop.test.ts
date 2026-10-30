import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { closeDb, getDb } from "@__NAME__/db";
import { eraseShopData } from "./erase-shop.ts";

// Integration: needs a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const RUN = randomUUID().slice(0, 8);
const EMAIL = `shopper-${RUN}@privacy.test`;

describe("eraseShopData", { skip }, () => {
  const tenantId = randomUUID();

  after(async () => {
    const client = getDb().$client;
    await client.query("delete from payload.orders where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from payload.carts where tenant_id = $1", [
      tenantId,
    ]);
    await client.query("delete from payload.tenants where id = $1", [tenantId]);
    await closeDb();
  });

  test("should unname the person's orders and drop their customer record", async () => {
    const client = getDb().$client;
    const userId = randomUUID();
    await client.query(
      `insert into payload.tenants (id, name, slug, updated_at, created_at)
       values ($1, $2, $2, now(), now())`,
      [tenantId, `erase-${RUN}`],
    );
    const {
      rows: [customer],
    } = await client.query<{ id: string }>(
      `insert into payload.customers (better_auth_user_id, email, updated_at, created_at)
       values ($1, $2, now(), now()) returning id`,
      [userId, EMAIL],
    );
    const order = (customerId: string | null, email: string) =>
      client.query<{ id: string }>(
        `insert into payload.orders (tenant_id, customer_id, customer_email, shipping_name,
           shipping_line1, shipping_city, shipping_postal_code, shipping_country, updated_at, created_at)
         values ($1, $2, $3, 'Ada Lovelace', '1 Mill Lane', 'Bath', 'BA1 1AA', 'GB', now(), now())
         returning id`,
        [tenantId, customerId, email],
      );
    const signedIn = (await order(customer.id, EMAIL)).rows[0];
    // A guest order with the same address, in different case.
    const guest = (await order(null, EMAIL.toUpperCase())).rows[0];
    const stranger = (await order(null, `other-${RUN}@privacy.test`)).rows[0];
    await client.query(
      `insert into payload.carts (tenant_id, customer_id, updated_at, created_at)
       values ($1, $2, now(), now())`,
      [tenantId, customer.id],
    );

    const result = await eraseShopData(userId, EMAIL);

    assert.deepEqual(result, { orders: 2, customers: 1 });
    const { rows } = await client.query(
      `select id, customer_id, customer_email, shipping_name, shipping_city, shipping_country
         from payload.orders where tenant_id = $1`,
      [tenantId],
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of [signedIn.id, guest.id]) {
      assert.deepEqual(byId.get(id), {
        id,
        customer_id: null,
        customer_email: null,
        shipping_name: null,
        shipping_city: null,
        shipping_country: "GB",
      });
    }
    assert.equal(byId.get(stranger.id)?.shipping_name, "Ada Lovelace");
    const carts = await client.query(
      "select 1 from payload.carts where tenant_id = $1",
      [tenantId],
    );
    assert.equal(carts.rowCount, 0, "the open cart is gone");
    const customers = await client.query(
      "select 1 from payload.customers where id = $1",
      [customer.id],
    );
    assert.equal(customers.rowCount, 0);
    // Safe to run twice: nothing left to match.
    assert.deepEqual(await eraseShopData(userId, EMAIL), {
      orders: 0,
      customers: 0,
    });
  });
});
