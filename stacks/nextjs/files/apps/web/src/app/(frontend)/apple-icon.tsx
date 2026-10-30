import { PNG_CONTENT_TYPE, renderIcon } from "@/lib/generated-images";

export const size = { width: 180, height: 180 };
export const contentType = PNG_CONTENT_TYPE;

export default function AppleIcon() {
  return renderIcon({ ...size, rounded: false });
}
