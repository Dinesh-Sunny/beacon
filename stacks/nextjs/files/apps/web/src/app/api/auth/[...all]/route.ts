import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Better Auth endpoints under /api/auth/*. This static `auth` segment takes precedence over
// Payload's /api/[...slug] catch-all.
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler((request) =>
  getAuth().handler(request),
);
