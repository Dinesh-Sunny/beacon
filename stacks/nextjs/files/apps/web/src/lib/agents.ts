// AI agents the web app exposes. Names match python/api's registry (__PYNAME___api/agents/registry.py);
// the proxy refuses anything else, so the browser can't reach other sidecar routes through it.
export const AGENTS = ["demo"] as const;
export type AgentName = (typeof AGENTS)[number];

export function isAgentName(value: string): value is AgentName {
  return (AGENTS as readonly string[]).includes(value);
}

// The agent the account assistant page talks to.
export const ACCOUNT_ASSISTANT_AGENT: AgentName = "demo";

// AI Gateway credentials the Python service uses: an API key locally, the deployment's OIDC
// token on Vercel (always present there). Unset locally: the page explains instead of failing.
export const AI_GATEWAY_API_KEY_ENV = "AI_GATEWAY_API_KEY";
export const VERCEL_OIDC_ENV = "VERCEL_OIDC_TOKEN";

// Same rule as __PYNAME___core.ai.gateway_credential(); on Vercel the token is always present.
export function isAiConfigured(): boolean {
  return Boolean(
    process.env[AI_GATEWAY_API_KEY_ENV] ||
      process.env[VERCEL_OIDC_ENV] ||
      process.env.VERCEL,
  );
}

// Browser-facing route the AG-UI client posts to; the sidecar path mirrors it.
export const AGENT_ROUTE = "/api/agents";
export const SIDECAR_AGENT_PATH = "/v1/agents";

// Per signed-in user, shared by runs and history reads. A run calls the model several times, so
// this bounds spend, not clicks; the sidecar also caps message size and output tokens.
export const AGENT_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;

// A run's request is the whole conversation; anything bigger isn't a real chat.
export const MAX_AGENT_REQUEST_BYTES = 512 * 1024;

// Vercel puts the deployment's OIDC token on each function request in this header; the proxy
// passes it on so the sidecar can call AI Gateway (__PYNAME___core.ai reads the same header).
export const VERCEL_OIDC_HEADER = "x-vercel-oidc-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isThreadId(value: string): boolean {
  return UUID.test(value);
}

// Conversations untouched this long are deleted with their LangGraph state (daily job).
export const AGENT_THREAD_RETENTION_DAYS = 90;
