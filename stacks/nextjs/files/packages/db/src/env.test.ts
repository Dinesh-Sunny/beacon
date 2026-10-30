import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DatabaseConfigError,
  directUrl,
  normalizeConnectionString,
  pooledUrl,
} from "./env.ts";

const LOCAL_URL = "postgresql://user:pass@localhost:5432/app";

describe("normalizeConnectionString", () => {
  test("should drop sslrootcert=system when given a PlanetScale URL", () => {
    const url = normalizeConnectionString(
      "postgresql://u:p@host.pg.psdb.cloud:6432/db?sslmode=verify-full&sslrootcert=system",
    );
    assert.equal(
      url,
      "postgresql://u:p@host.pg.psdb.cloud:6432/db?sslmode=verify-full",
    );
  });

  test("should keep a file-path sslrootcert when one is given", () => {
    const url = normalizeConnectionString(
      `${LOCAL_URL}?sslrootcert=/etc/ssl/ca.pem`,
    );
    assert.equal(
      new URL(url).searchParams.get("sslrootcert"),
      "/etc/ssl/ca.pem",
    );
  });

  test("should reject a non-Postgres URL", () => {
    assert.throws(
      () => normalizeConnectionString("mysql://u:p@host/db"),
      DatabaseConfigError,
    );
  });

  test("should reject a malformed URL", () => {
    assert.throws(
      () => normalizeConnectionString("not a url"),
      DatabaseConfigError,
    );
  });
});

describe("pooledUrl and directUrl", () => {
  test("should read each variable when both are set", () => {
    const env = {
      DATABASE_URL: `${LOCAL_URL}?pool=1`,
      DATABASE_URL_UNPOOLED: LOCAL_URL,
    };
    assert.equal(pooledUrl(env), `${LOCAL_URL}?pool=1`);
    assert.equal(directUrl(env), LOCAL_URL);
  });

  test("should throw when the direct URL is missing", () => {
    assert.throws(
      () => directUrl({ DATABASE_URL: LOCAL_URL }),
      /DATABASE_URL_UNPOOLED is not set/,
    );
  });
});
