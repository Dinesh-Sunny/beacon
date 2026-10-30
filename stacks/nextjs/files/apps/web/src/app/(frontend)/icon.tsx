import { PNG_CONTENT_TYPE, renderIcon } from "@/lib/generated-images";

export const size = { width: 512, height: 512 };
export const contentType = PNG_CONTENT_TYPE;

export default function Icon() {
  return renderIcon({ ...size, rounded: true });
}
