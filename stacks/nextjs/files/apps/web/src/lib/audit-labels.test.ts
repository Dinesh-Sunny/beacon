import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AuditEvent } from "@__NAME__/db";
import { encodeAuditCursor, parseAuditCursor } from "./audit-cursor.ts";
import { toAuditEvent } from "./audit-events.ts";
import {
  auditActorName,
  describeAuditEvent,
  FORMER_MEMBER,
  SYSTEM_ACTOR,
} from "./audit-labels.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const MATE = "33333333-3333-4333-8333-333333333333";

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    occurredAt: new Date("2026-10-03T12:00:00Z"),
    action: "member.added",
    actorId: OWNER,
    organizationId: ORG,
    targetType: "user",
    targetId: MATE,
    metadata: {},
    ...overrides,
  };
}

describe("toAuditEvent", () => {
  test("should record role changes with the member as target and both roles", () => {
    assert.deepEqual(
      toAuditEvent({
        type: "member.role_changed",
        actorId: OWNER,
        organizationId: ORG,
        memberUserId: MATE,
        role: "admin",
        previousRole: "member",
      }),
      {
        action: "member.role_changed",
        actorId: OWNER,
        organizationId: ORG,
        target: { type: "user", id: MATE },
        metadata: { role: "admin", previousRole: "member" },
      },
    );
  });

  test("should map two-factor changes to on and off, and skip profile edits", () => {
    assert.equal(
      toAuditEvent({
        type: "user.two_factor_changed",
        userId: OWNER,
        enabled: true,
      })?.action,
      "user.two_factor_enabled",
    );
    assert.equal(toAuditEvent({ type: "user.updated", userId: OWNER }), null);
  });
});

describe("audit labels", () => {
  const names = new Map([
    [OWNER, "Ada"],
    [MATE, "Grace"],
  ]);

  test("should name current members and describe what changed", () => {
    const changed = event({
      action: "member.role_changed",
      metadata: { role: "admin", previousRole: "member" },
    });
    assert.equal(auditActorName(changed, names), "Ada");
    assert.equal(
      describeAuditEvent(changed, names),
      "Changed Grace from member to admin",
    );
  });

  test("should not invent names for people who left, or for system changes", () => {
    const gone = new Map<string, string>();
    assert.equal(auditActorName(event({}), gone), FORMER_MEMBER);
    assert.equal(
      describeAuditEvent(event({ metadata: { role: "member" } }), gone),
      "Added a former member as member",
    );
    assert.equal(auditActorName(event({ actorId: null }), names), SYSTEM_ACTOR);
  });
});

describe("audit cursor", () => {
  test("should round-trip a cursor and reject anything malformed", () => {
    const cursor = {
      occurredAt: "2026-10-03T12:00:00.123456Z",
      id: "44444444-4444-4444-8444-444444444444",
    };
    assert.deepEqual(parseAuditCursor(encodeAuditCursor(cursor)), cursor);
    for (const value of [
      undefined,
      ["a"],
      "",
      "2026-10-03T12:00:00Z_44444444-4444-4444-8444-444444444444",
      "2026-10-03T12:00:00.123456Z_not-a-uuid",
      "2026-99-99T12:00:00.123456Z_44444444-4444-4444-8444-444444444444",
      "2026-10-03T12:00:00.123456Z_44444444-4444-4444-8444-444444444444_x",
    ]) {
      assert.equal(parseAuditCursor(value), null, JSON.stringify(value));
    }
  });
});
