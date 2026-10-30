import { forwardToAgent } from "@/lib/agent-proxy";
import { isThreadId, SIDECAR_AGENT_PATH } from "@/lib/agents";

// A conversation's messages (AG-UI form), for reopening it. Only its owner gets them.
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/agents/[agent]/threads/[thread]">,
): Promise<Response> {
  const { agent, thread } = await params;
  if (!isThreadId(thread)) {
    return Response.json({ message: "Unknown thread" }, { status: 404 });
  }
  return forwardToAgent(
    request,
    agent,
    `${SIDECAR_AGENT_PATH}/${agent}/threads/${encodeURIComponent(thread)}/messages`,
  );
}
