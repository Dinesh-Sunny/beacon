import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyticsConsentState,
  isConsentExpired,
  isWithdrawal,
  MS_PER_DAY,
} from "./state.ts";

const NOW = Date.UTC(2026, 9, 2);
const EXPIRY_DAYS = 182;
const chosen = (daysAgo: number, extra = {}) => ({
  time: NOW - daysAgo * MS_PER_DAY,
  ...extra,
});

test("should be undecided when no choice is stored", () => {
  assert.equal(
    analyticsConsentState({
      consent: null,
      measurement: true,
      now: NOW,
      expiryDays: EXPIRY_DAYS,
    }),
    "undecided",
  );
});

test("should be undecided when the policy changed and needs a fresh choice", () => {
  assert.equal(
    analyticsConsentState({
      consent: chosen(1, { requiresReconsent: true }),
      measurement: true,
      now: NOW,
      expiryDays: EXPIRY_DAYS,
    }),
    "undecided",
  );
});

test("should be undecided when the choice is older than the expiry", () => {
  assert.equal(
    analyticsConsentState({
      consent: chosen(183),
      measurement: true,
      now: NOW,
      expiryDays: EXPIRY_DAYS,
    }),
    "undecided",
  );
  assert.equal(isConsentExpired(chosen(182), NOW, EXPIRY_DAYS), false);
});

test("should follow the measurement choice when a current choice exists", () => {
  const base = { consent: chosen(10), now: NOW, expiryDays: EXPIRY_DAYS };
  assert.equal(
    analyticsConsentState({ ...base, measurement: true }),
    "granted",
  );
  assert.equal(
    analyticsConsentState({ ...base, measurement: false }),
    "denied",
  );
});

test("should flag a withdrawal only when a category was turned off", () => {
  assert.equal(isWithdrawal(["necessary", "measurement"], ["necessary"]), true);
  assert.equal(
    isWithdrawal(["necessary"], ["necessary", "measurement"]),
    false,
  );
  assert.equal(isWithdrawal(["necessary"], ["necessary"]), false);
});
