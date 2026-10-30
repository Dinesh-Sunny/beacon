import { createMcpHandler } from "mcp-handler";
import {
  CheckEligibilityInput,
  checkEligibility,
  GetRulesInput,
  getRules,
  ListSchemesInput,
  listSchemes,
} from "@/lib/mcp-tools";

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
      async (input) => json(await checkEligibility(input)),
    );
  },
  { serverInfo: { name: "beacon", version: "0.1.0" } },
);

export { handler as GET, handler as POST, handler as DELETE };
