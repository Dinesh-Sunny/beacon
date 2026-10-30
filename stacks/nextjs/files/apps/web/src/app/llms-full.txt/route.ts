import { markdownResponse } from "@/lib/agent-markdown";
import { llmsFullTxt } from "@/lib/llms-txt";
import { getSiteForRequest } from "@/lib/tenant";

const NOT_FOUND = 404;

export async function GET(): Promise<Response> {
  const site = await getSiteForRequest();
  if (!site) return markdownResponse("# Not found\n", null, NOT_FOUND);
  const origin = site.origin.toString();
  return markdownResponse(
    await llmsFullTxt({
      tenantId: site.tenant.id,
      origin,
      name: site.name,
      description: site.description,
    }),
    origin,
  );
}
