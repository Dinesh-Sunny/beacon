import { markdownResponse, publishedPageMarkdown } from "@/lib/agent-markdown";
import { INDEX_SEGMENT, pagePath } from "@/lib/page-path";
import { getSiteForRequest } from "@/lib/tenant";
import { HOME_SLUG } from "@/payload/constants";

const NOT_FOUND = 404;

// A published CMS page of the request's site as Markdown. Reached through next.config.ts
// rewrites (`/<slug>.md`, `/index.md`, or `Accept: text/markdown`), not linked directly.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/md/[[...slug]]">,
): Promise<Response> {
  const { slug: segments = [] } = await params;
  const [segment = INDEX_SEGMENT, ...rest] = segments;
  const slug = segment === INDEX_SEGMENT ? HOME_SLUG : segment;
  const site = await getSiteForRequest();
  const markdown =
    site && rest.length === 0
      ? await publishedPageMarkdown(
          site.tenant.id,
          slug,
          site.origin.toString(),
        )
      : null;
  if (!site || markdown === null) {
    return markdownResponse("# Page not found\n", null, NOT_FOUND);
  }
  return markdownResponse(
    markdown,
    new URL(pagePath(slug), site.origin).toString(),
  );
}
