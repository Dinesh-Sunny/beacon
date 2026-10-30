// Beam through any OpenAI-compatible endpoint. @langchain/openai forwards `reasoning` only for
// OpenAI's own reasoning models (isReasoningModel), so reasoning_effort goes in modelKwargs, which
// is spread into the request body as is. Some routers reject unknown fields: the first rejection is
// logged once and every later call goes without it.

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage, BaseMessageLike } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  type BeamEnv,
  EFFORT,
  LIMITS,
  MAX_OUTPUT_TOKENS,
  SAMPLING,
  type Step,
} from "./config.ts";

export class BeamUnavailableError extends Error {
  constructor(
    message = "No Beam endpoint configured (set HF_TOKEN or BEAM_API_KEY)",
  ) {
    super(message);
    this.name = "BeamUnavailableError";
  }
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
});
export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

/** Token counts from one model reply (OpenAI-compatible servers report them as usage). */
export function usageOf(message: unknown): Usage {
  const meta = (message as Partial<AIMessage> | undefined)?.usage_metadata;
  return {
    inputTokens: meta?.input_tokens ?? 0,
    outputTokens: meta?.output_tokens ?? 0,
  };
}

let effortSupported = true;

/** Whether reasoning_effort is still being sent (false after a router rejected it once). */
export const sendsEffort = (): boolean => effortSupported;

/** For tests: start each run as if no rejection had been seen. */
export function resetEffortSupport(): void {
  effortSupported = true;
}

/** A 400/422 that names the field means this endpoint does not take it. */
export function isEffortRejected(error: unknown): boolean {
  const e = error as { status?: number; message?: string } | undefined;
  if (!e || (e.status !== 400 && e.status !== 422)) return false;
  return /reasoning[_ ]?effort|reasoning/i.test(e.message ?? "");
}

function markEffortUnsupported(error: unknown): void {
  if (!effortSupported) return;
  effortSupported = false;
  console.warn(
    `[brain] endpoint rejected reasoning_effort, continuing without it: ${(error as Error).message}`,
  );
}

/** One Beam client for one step, with or without reasoning_effort. */
export function createBeamModel(
  env: BeamEnv,
  step: Step,
  withEffort = true,
): ChatOpenAI {
  if (!env.apiKey) throw new BeamUnavailableError();
  return new ChatOpenAI({
    model: env.model,
    apiKey: env.apiKey,
    configuration: { baseURL: env.baseUrl },
    useResponsesApi: false,
    temperature: SAMPLING.temperature,
    topP: SAMPLING.topP,
    maxTokens: MAX_OUTPUT_TOKENS[step],
    timeout: LIMITS.callTimeoutMs,
    maxRetries: LIMITS.retries,
    ...(withEffort ? { modelKwargs: { reasoning_effort: EFFORT[step] } } : {}),
  });
}

/** The pair a step needs: the preferred model and the one to fall back to without effort. */
export interface StepModels {
  step: Step;
  preferred: BaseChatModel;
  plain: BaseChatModel;
}

/** Real Beam clients for a step, or the injected model (tests, evals) used for both. */
export function stepModels(
  env: BeamEnv | undefined,
  step: Step,
  injected?: BaseChatModel,
): StepModels {
  if (injected) return { step, preferred: injected, plain: injected };
  if (!env) throw new BeamUnavailableError();
  return {
    step,
    preferred: createBeamModel(env, step, true),
    plain: createBeamModel(env, step, false),
  };
}

/** The model to use now: preferred until the endpoint has rejected reasoning_effort. */
export const currentModel = (m: StepModels): BaseChatModel =>
  effortSupported ? m.preferred : m.plain;

/** Runs `call` with the current model; retries once with the plain one if effort is rejected. */
export async function withEffortFallback<T>(
  m: StepModels,
  call: (model: BaseChatModel) => Promise<T>,
): Promise<T> {
  const model = currentModel(m);
  try {
    return await call(model);
  } catch (error) {
    if (model === m.plain || !isEffortRejected(error)) throw error;
    markEffortUnsupported(error);
    return call(m.plain);
  }
}

/** Plain-text call for one step (explain), with usage. */
export async function invokeText(
  m: StepModels,
  messages: BaseMessageLike[],
  signal?: AbortSignal,
): Promise<{ text: string; usage: Usage }> {
  const reply = await withEffortFallback(m, (model) =>
    model.invoke(messages, { signal }),
  );
  return { text: reply.text, usage: usageOf(reply) };
}
