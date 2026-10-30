import { createMcpHandler } from "mcp-handler";
import { limit, readBody } from "@/lib/guard";
import {
  CheckEligibilityInput,
  checkEligibility,
  GetRulesInput,
  getRules,
  ListSchemesInput,
  listSchemes,
} from "@/lib/mcp-tools";
import { recordTokens } from "@/lib/rate-limit";

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_schemes",
      {
        title: "List schemes",
        description:
          "The kinds of UK support Beacon checks, with who runs each and how to claim.",
        inputSchema: ListSchemesInput,
      },
      async () => json(listSchemes()),
    );
    server.registerTool(
      "get_rules",
      {
        title: "Get rules",
        description: "Read the official GOV.UK pages for one scheme, dated.",
        inputSchema: GetRulesInput,
      },
      async (input) => json(await getRules(input)),
    );
    server.registerTool(
      "check_eligibility",
      {
        title: "Check a situation",
        description:
          "Run a full check for a situation (bands only, no personal details): hard rules in code, then each open scheme read from GOV.UK with a verified quote.",
        inputSchema: CheckEligibilityInput,
      },
      async (input, extra) => {
        const result = await checkEligibility(input, {
          signal: extra.mcpReq.signal,
        });
        recordTokens(result.tokens);
        return json(result);
      },
    );
  },
  { serverInfo: { name: "beacon", version: "0.1.0" } },
);

/** A full check reads up to ten pages with Beam, so it costs as much as several requests. */
const CHECK_WEIGHT = 5;

function weightOf(body: unknown): number {
  const calls = Array.isArray(body) ? body : [body];
  return calls.reduce<number>((sum, c) => {
    const call = c as { method?: string; params?: { name?: string } } | null;
    const isCheck =
      call?.method === "tools/call" &&
      call.params?.name === "check_eligibility";
    return sum + (isCheck ? CHECK_WEIGHT : 1);
  }, 0);
}

// Same limits as the web routes: body size cap, then per-IP and daily slots weighted by cost.
async function POST(request: Request) {
  const read = await readBody(request.clone(), "mcp");
  if (read instanceof Response) return read;
  const busy = limit(request, "mcp", Math.max(1, weightOf(read.body)));
  if (busy) return busy;
  return handler(request);
}

export { handler as GET, handler as DELETE, POST };
