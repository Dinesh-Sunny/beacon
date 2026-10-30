// Typed client for the private Python sidecar (python/api). Server-side only.
// On Vercel the service binding injects BACKEND_INTERNAL_URL at runtime; locally set PYTHON_API_URL.
const DEFAULT_LOCAL_URL = "http://127.0.0.1:8000";

export type TextStats = {
  words: number;
  characters: number;
  top_words: [string, number][];
};

export function pythonApiBaseUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ??
    process.env.PYTHON_API_URL ??
    DEFAULT_LOCAL_URL
  );
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, pythonApiBaseUrl()), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Python API ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getTextStats(text: string): Promise<TextStats> {
  return post<TextStats>("/v1/text-stats", { text });
}

export type SidecarUser = { user_id: string; email: string | null };

// Calls a user-scoped sidecar endpoint. `serviceToken` comes from
// getAuth().api.getToken({ headers }) on the server: a 15-minute EdDSA JWT the sidecar verifies
// against /api/auth/jwks. Never pass the session cookie itself.
export async function getSidecarUser(
  serviceToken: string,
): Promise<SidecarUser> {
  const response = await fetch(new URL("/v1/me", pythonApiBaseUrl()), {
    headers: { authorization: `Bearer ${serviceToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Python API /v1/me failed with ${response.status}`);
  }
  return (await response.json()) as SidecarUser;
}
