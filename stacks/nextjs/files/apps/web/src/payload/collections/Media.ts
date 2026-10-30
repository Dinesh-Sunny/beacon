import type { CollectionConfig } from "payload";
import { isAuthenticated } from "../access";
import { COLLECTIONS } from "../constants";
import {
  revalidatePagesOnMediaChange,
  revalidatePagesOnMediaDelete,
} from "../hooks/revalidate";

// Images for the site. Local disk in development; S3-compatible storage (Cloudflare R2) once
// configured, see storage.ts. sharp generates the sizes at upload.
export const Media: CollectionConfig = {
  slug: COLLECTIONS.media,
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  upload: {
    mimeTypes: ["image/*"],
    focalPoint: true,
    imageSizes: [
      { name: "thumbnail", width: 400 },
      { name: "card", width: 768 },
      { name: "feature", width: 1536 },
    ],
    adminThumbnail: "thumbnail",
  },
  hooks: {
    afterChange: [revalidatePagesOnMediaChange],
    afterDelete: [revalidatePagesOnMediaDelete],
  },
  fields: [{ name: "alt", type: "text", required: true }],
};
