import { isIP } from "node:net";

// Shared by every caller with no usable address (local dev, a missing or forged header), so
// they count together rather than going unlimited.
export const UNKNOWN_CLIENT = "unknown";

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

// Expands "2001:db8::1" to its eight groups so the /64 prefix can be read off.
function ipv6Groups(ip: string): string[] {
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = ip.includes("::") ? 8 - left.length - right.length : 0;
  return [...left, ...Array<string>(missing).fill("0"), ...right];
}

// The rate-limit key for a client address. Anything that isn't an IP becomes UNKNOWN_CLIENT, so
// a client able to set the header can't mint a fresh bucket (or a huge key) per request. IPv6
// collapses to its /64, the block one subscriber gets, as Better Auth does for its own limits.
export function clientKey(ip: string | null | undefined): string {
  const value = ip?.trim() ?? "";
  const mapped = IPV4_MAPPED.exec(value)?.[1];
  if (mapped && isIP(mapped) === 4) return mapped;
  switch (isIP(value)) {
    case 4:
      return value;
    case 6:
      return `${ipv6Groups(value.toLowerCase())
        .slice(0, 4)
        .map((group) => group.replace(/^0+(?=.)/, ""))
        .join(":")}::/64`;
    default:
      return UNKNOWN_CLIENT;
  }
}
