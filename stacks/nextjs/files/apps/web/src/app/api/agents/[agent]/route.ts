import { forwardToAgent } from "@/lib/agent-proxy";
import { SIDECAR_AGENT_PATH } from "@/lib/agents";

// A run streams for as long as the agent works; Hobby allows 300 s (Pro: up to 800).
export const maxDuration = 300;

// One agent run: AG-UI events as server-sent events.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/agents/[agent]">,
): Promise<Response> {
  const { agent } = await params;
  return forwardToAgent(request, agent, `${SIDECAR_AGENT_PATH}/${agent}`);
}
