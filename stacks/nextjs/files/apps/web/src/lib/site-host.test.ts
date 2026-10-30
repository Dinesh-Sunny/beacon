import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isUnderBaseDomain,
  normalizeHost,
  siteParamHost,
  subdomainSlug,
} from "./site-host.ts";

test("should normalise hosts the way the router compares them", () => {
  assert.equal(normalizeHost("Shop.Example.COM:443"), "shop.example.com");
  assert.equal(normalizeHost("localhost:3000"), "localhost");
  assert.equal(normalizeHost("acme.localhost"), "acme.localhost");
  assert.equal(normalizeHost("acme.com."), "acme.com");
  for (const bad of [
    "",
    null,
    "exa mple.com",
    "-bad.com",
    "a/b",
    "evil.com%2f..",
    "%61cme.com",
    "monitoring",
    "x".repeat(300),
  ]) {
    assert.equal(normalizeHost(bad), null, String(bad));
  }
});

test("should accept only canonical hosts as the [site] segment", () => {
  assert.equal(siteParamHost("acme.com"), "acme.com");
  assert.equal(siteParamHost("localhost"), "localhost");
  for (const bad of [
    "Acme.com",
    "acme.com:3000",
    "api",
    "monitoring",
    "accept-invitation",
    "_next",
    "%E0",
  ]) {
    assert.equal(siteParamHost(bad), null, bad);
  }
});

test("should read a tenant slug from one label under the base domain only", () => {
  assert.equal(subdomainSlug("acme.sites.test", "sites.test"), "acme");
  assert.equal(subdomainSlug("a.b.sites.test", "sites.test"), null);
  assert.equal(subdomainSlug("sites.test", "sites.test"), null);
  assert.equal(subdomainSlug("acme.other.test", "sites.test"), null);
  assert.equal(subdomainSlug("acme.sites.test", undefined), null);
  assert.equal(isUnderBaseDomain("x.sites.test", "sites.test"), true);
  assert.equal(isUnderBaseDomain("shop.example.com", "sites.test"), false);
});
