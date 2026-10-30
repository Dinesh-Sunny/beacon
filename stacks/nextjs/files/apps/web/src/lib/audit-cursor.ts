import type { AuditCursor } from "@__NAME__/db";

// The Activity page's "Older" link carries the last event as `<UTC time>_<uuid>`, in the format
// listAuditEvents returns. Pure so it can be tested; anything malformed means "first page".
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEPARATOR = "_";

export function encodeAuditCursor(cursor: AuditCursor): string {
  return `${cursor.occurredAt}${SEPARATOR}${cursor.id}`;
}

export function parseAuditCursor(value: unknown): AuditCursor | null {
  if (typeof value !== "string") return null;
  const [occurredAt, id, ...rest] = value.split(SEPARATOR);
  if (rest.length > 0 || !occurredAt || !id) return null;
  // The shape check alone would let 2026-99-99 through to a failing SQL cast.
  if (!TIME.test(occurredAt) || Number.isNaN(Date.parse(occurredAt)))
    return null;
  if (!UUID.test(id)) return null;
  return { occurredAt, id };
}
