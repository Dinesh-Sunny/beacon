import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AuthConfigError, resolveAuthOrigins } from "./origins.ts";

describe("resolveAuthOrigins", () => {
  test("should trust only the production hosts when deployed to production", () => {
    const origins = resolveAuthOrigins({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://app.example.com",
      VERCEL_URL: "__NAME__-abc123.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "__NAME__.vercel.app",
    });
    assert.equal(origins.canonical, "https://app.example.com");
    // Sort both sides: forks rename the hosts, which changes their sort order.
    assert.deepEqual(
      origins.allowedHosts.sort(),
      [
        "__NAME__-abc123.vercel.app",
        "__NAME__.vercel.app",
        "app.example.com",
      ].sort(),
    );
  });

  test("should use the branch URL as canonical when deployed as a preview", () => {
    const origins = resolveAuthOrigins({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      BETTER_AUTH_URL: "https://app.example.com",
      VERCEL_URL: "__NAME__-def456.vercel.app",
      VERCEL_BRANCH_URL: "__NAME__-git-feature.vercel.app",
    });
    assert.equal(origins.canonical, "https://__NAME__-git-feature.vercel.app");
    assert.ok(!origins.allowedHosts.some((host) => host.includes("*")));
  });

  test("should allow any localhost port when running locally", () => {
    const origins = resolveAuthOrigins({ NODE_ENV: "development" });
    assert.equal(origins.canonical, "http://localhost:3000");
    assert.deepEqual(origins.allowedHosts, ["localhost:*"]);
  });

  test("should throw when production has no canonical origin", () => {
    assert.throws(
      () => resolveAuthOrigins({ NODE_ENV: "production" }),
      AuthConfigError,
    );
  });
});
