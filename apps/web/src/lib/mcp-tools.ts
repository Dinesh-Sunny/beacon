// MCP tools for /api/mcp, from packages/brain: plain functions plus the zod schemas they parse with.

import "server-only";

export {
  CheckEligibilityInput,
  checkEligibility,
  GetRulesInput,
  getRules,
  ListSchemesInput,
  listSchemes,
} from "@beacon/brain/mcp";
