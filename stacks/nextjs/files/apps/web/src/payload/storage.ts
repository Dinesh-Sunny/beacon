import { s3Storage } from "@payloadcms/storage-s3";
import { COLLECTIONS } from "./constants";

// S3-compatible object storage for uploads (Cloudflare R2 by default). Without S3_BUCKET,
// uploads go to local disk, which is fine for development but lost on Vercel deploys.
const env = process.env;
const publicUrl = env.MEDIA_PUBLIC_URL?.replace(/\/$/, "");

export const storagePlugin = s3Storage({
  enabled: Boolean(env.S3_BUCKET),
  // Same columns with or without storage configured, so migrations match across environments.
  alwaysInsertFields: true,
  bucket: env.S3_BUCKET ?? "",
  config: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? "auto",
    // R2 and most S3-compatible services need path-style URLs.
    forcePathStyle: true,
    // AWS SDK >= 3.729 adds checksum params to presigned PUT URLs, which R2 rejects for browser
    // (client) uploads. Cloudflare's R2 guide turns them off.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
  },
  // Browser uploads straight to the bucket: Vercel Functions cap request bodies at 4.5 MB.
  // The bucket's CORS rules must allow PUT from the site origin.
  clientUploads: true,
  collections: {
    [COLLECTIONS.media]: publicUrl
      ? {
          prefix: COLLECTIONS.media,
          // Served from a public custom domain (CDN) instead of streaming through Payload.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) =>
            `${publicUrl}/${prefix ? `${prefix}/` : ""}${filename}`,
        }
      : { prefix: COLLECTIONS.media },
  },
});
