import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MIGRATE_ON_BUILD_ENV } from "./config.ts";
import { isBuildMigrationEnabled } from "./migrate.ts";

describe("isBuildMigrationEnabled", () => {
  test("should be enabled when the flag is 1", () => {
    assert.equal(
      isBuildMigrationEnabled({ [MIGRATE_ON_BUILD_ENV]: "1" }),
      true,
    );
  });

  test("should be disabled when the flag is missing or not 1", () => {
    assert.equal(isBuildMigrationEnabled({}), false);
    assert.equal(
      isBuildMigrationEnabled({ [MIGRATE_ON_BUILD_ENV]: "true" }),
      false,
    );
  });
});
