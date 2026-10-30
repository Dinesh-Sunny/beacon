import config from "@payload-config";
import { getPayload, type Payload } from "payload";

// Local API entry point for server code (Server Components, actions, route handlers). Payload
// caches the instance per process, so calling this per request is cheap. Local API calls skip
// access control unless you pass `overrideAccess: false` (Payload 4 flips the default), so pass
// it whenever a request acts on behalf of a user.
export function getPayloadClient(): Promise<Payload> {
  return getPayload({ config });
}
