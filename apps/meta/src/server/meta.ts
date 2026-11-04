import "server-only";

// Thin client for the Meta Model API (OpenAI-compatible Chat Completions, plus the image, voice
// and segmentation endpoints). Docs: https://dev.meta.ai/docs/overview

export const META = {
  base: process.env.META_BASE_URL || "https://api.meta.ai/v1",
  text: process.env.META_TEXT_MODEL || "muse-spark-1.3",
  /** Muse Wonder: Meta's stronger reasoning model, for the call notes people rely on most. */
  wonder: process.env.META_WONDER_MODEL || "muse-wonder-1.0",
  image: "muse-image-1.0",
  voice: "muse-voice-transcribe-1.0",
  sam: "sam-3.1",
};

export class MetaOffline extends Error {
  constructor() {
    super("MODEL_API_KEY is not set");
    this.name = "MetaOffline";
  }
}
export class MetaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MetaError";
    this.status = status;
  }
}

function key(): string {
  const k = process.env.MODEL_API_KEY;
  if (!k) throw new MetaOffline();
  return k;
}

async function call(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const res = await fetch(`${META.base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MetaError(res.status, text.slice(0, 300));
  }
  return res;
}

export type Effort = "minimal" | "low" | "medium" | "high";
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export type ChatMessage =
  | { role: "system" | "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export async function chat(opts: {
  messages: ChatMessage[];
  tools?: unknown[];
  schema?: { name: string; schema: unknown };
  effort?: Effort;
  maxTokens?: number;
  timeoutMs?: number;
  /** Groups requests that share a long fixed prefix so Meta's automatic prompt cache hits more often. */
  cacheKey?: string;
  /** A Meta model other than the default text model (for example Muse Wonder). */
  model?: string;
}): Promise<{
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage?: Usage;
}> {
  const model = opts.model ?? META.text;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    reasoning_effort: opts.effort ?? "low",
    max_completion_tokens: opts.maxTokens ?? 1500,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.cacheKey) body.prompt_cache_key = opts.cacheKey;
  if (opts.schema)
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schema.name, schema: opts.schema.schema },
    };
  const started = Date.now();
  const res = await call(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    opts.timeoutMs ?? 55_000,
  );
  const json = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
    usage?: Usage;
  };
  const message = json.choices?.[0]?.message;
  if (!message) throw new MetaError(502, "Empty reply");
  // Cost telemetry: model, tokens and time only, never content.
  console.info(
    JSON.stringify({
      evt: "model_call",
      job: opts.cacheKey ?? "other",
      model,
      tools: Boolean(opts.tools?.length),
      in: json.usage?.prompt_tokens ?? 0,
      cached: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      out: json.usage?.completion_tokens ?? 0,
      ms: Date.now() - started,
    }),
  );
  return { message, usage: json.usage };
}

/** Muse Voice Transcribe: one WAV (mono 16-bit PCM, 16 or 24 kHz) in, the transcript out. */
export async function transcribe(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "PUSH_TO_TALK",
          model: META.voice,
          audioEncoding: "WAV",
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("audio", wav, "speech.wav");
  // No Accept header: the default reply is JSON; other Accept values are refused (406).
  const res = await call(
    "/asr/transcribe",
    { method: "POST", body: form },
    45_000,
  );
  const json = (await res.json()) as { transcript?: string };
  return (json.transcript ?? "").trim();
}

/** Muse Image: one picture from a prompt, returned as a data URL. */
export async function image(
  prompt: string,
  size = "1536x1024",
): Promise<string> {
  const res = await call(
    "/images/generations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: META.image,
        prompt,
        n: 1,
        size,
        response_format: "b64_json",
        output_format: "webp",
      }),
    },
    90_000,
  );
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new MetaError(502, "No image returned");
  return `data:image/webp;base64,${b64}`;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  c?: number;
}

/** SAM 3.1 through the Responses API: boxes for one short noun phrase in an image. */
export async function segment(
  imageDataUrl: string,
  prompt: string,
): Promise<Box[]> {
  const res = await call(
    "/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: META.sam,
        stream: true,
        metadata: { include_confidence: "true", mask_encoding: "one_bit" },
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageDataUrl },
            ],
          },
        ],
      }),
    },
    40_000,
  );
  const text = await res.text();
  let out = "";
  const types = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const ev = JSON.parse(line.slice(5).trim()) as {
        type?: string;
        delta?: string;
        text?: string;
      };
      if (ev.type) types.add(ev.type);
      if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      if (ev.type === "response.output_text.done" && !out && ev.text)
        out = ev.text;
    } catch {
      /* keep-alive or [DONE] */
    }
  }
  if (process.env.NODE_ENV !== "production" && !out)
    console.warn("[sam] empty output", text.slice(0, 400));
  lastSamRaw = `${prompt}: types=${[...types].join(",")} out=${out.slice(0, 300)} tail=${text.slice(-300)}`;
  return parseBoxes(out);
}

/** Last raw SAM stream (development only, for debugging the parser). */
export let lastSamRaw = "";

export function parseBoxes(out: string): Box[] {
  const boxes: Box[] = [];
  for (const m of out.matchAll(/<\|box;([^|]*)\|>/g)) {
    const kv = Object.fromEntries(
      (m[1] ?? "").split(";").map((p) => {
        const [k, v] = p.split("=");
        return [k, Number(v)];
      }),
    ) as Record<string, number>;
    if ([kv.x1, kv.y1, kv.x2, kv.y2].every((n) => Number.isFinite(n)))
      boxes.push({
        x1: kv.x1 ?? 0,
        y1: kv.y1 ?? 0,
        x2: kv.x2 ?? 0,
        y2: kv.y2 ?? 0,
        w: kv.w ?? 0,
        h: kv.h ?? 0,
        c: kv.c,
      });
  }
  return boxes;
}
