// Reads official pages through the GOV.UK Content API (free, no key) and keeps a dated snapshot so
// every run can be reproduced. https://content-api.publishing.service.gov.uk

import { GOVUK_READ, RULES_AS_OF } from "./config.ts";

export interface RulePage {
  path: string;
  url: string;
  title: string;
  /** Plain text of the page, all guide parts joined with their headings */
  text: string;
  /** When GOV.UK last changed it */
  publicUpdatedAt: string;
  /** When Beacon read it */
  readAt: string;
}

interface ContentItem {
  title?: string;
  base_path?: string;
  public_updated_at?: string;
  details?: {
    body?: string;
    parts?: Array<{ title?: string; slug?: string; body?: string }>;
  };
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&pound;": "£",
};

/** HTML to readable text: keeps list items and paragraphs as lines, drops tags. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h[1-6]|tr|div|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(
      /&[a-z#0-9]+;/gi,
      (e) =>
        ENTITIES[e.toLowerCase()] ??
        (e.startsWith("&#") ? String.fromCharCode(Number(e.slice(2, -1))) : e),
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageFromContent(
  path: string,
  item: ContentItem,
  readAt: string,
): RulePage {
  const parts = item.details?.parts;
  const text = parts?.length
    ? parts
        .map((p) => `## ${p.title ?? ""}\n${htmlToText(p.body ?? "")}`)
        .join("\n\n")
    : htmlToText(item.details?.body ?? "");
  return {
    path,
    url: `https://www.gov.uk${item.base_path ?? path}`,
    title: item.title ?? path,
    text,
    publicUpdatedAt: item.public_updated_at ?? "",
    readAt,
  };
}

export class GovukReadError extends Error {
  readonly path: string;
  readonly status: number;
  constructor(path: string, status: number) {
    super(`GOV.UK page ${path} answered ${status}`);
    this.path = path;
    this.status = status;
  }
}

/** Live read. Falls back to the snapshot in the caller when this throws. */
export async function readGovuk(
  path: string,
  fetcher: typeof fetch = fetch,
): Promise<RulePage> {
  const res = await fetcher(`https://www.gov.uk/api/content${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(GOVUK_READ.timeoutMs),
  });
  if (!res.ok) throw new GovukReadError(path, res.status);
  if (Number(res.headers.get("content-length") ?? "0") > GOVUK_READ.maxBytes)
    throw new GovukReadError(path, 413);
  return pageFromContent(
    path,
    (await res.json()) as ContentItem,
    new Date().toISOString(),
  );
}

export const SNAPSHOT_DATE = RULES_AS_OF;
