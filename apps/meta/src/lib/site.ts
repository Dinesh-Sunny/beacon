// The site's public address, for absolute links in metadata. Set SITE_URL when deployed.
export const SITE_URL = (
  process.env.SITE_URL ?? "http://localhost:3100"
).replace(/\/$/, "");
