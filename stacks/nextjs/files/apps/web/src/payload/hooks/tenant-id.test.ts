import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantIdOf } from "./tenant-id.ts";

test("should read a document's tenant whether it's an id or populated", () => {
  assert.equal(tenantIdOf({ tenant: "t-1" }), "t-1");
  assert.equal(tenantIdOf({ tenant: { id: "t-2", slug: "acme" } }), "t-2");
  assert.equal(tenantIdOf({ tenant: null }), null);
  assert.equal(tenantIdOf({}), null);
  assert.equal(tenantIdOf(null), null);
});
