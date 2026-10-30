// One check, end to end: precheck in code, then one rule reader per open scheme on Beam, each
// recording its finding through record_finding (settled in code), streamed as CheckEvents.
//
// Why a parallel loop of deep agents rather than one orchestrator with `task` subagents: a `task`
// subagent hands its parent only its final text, so its record_finding calls and token usage cannot
// stream to the browser as they happen, and the orchestrator would add Beam calls that decide
// nothing (precheck already chose the schemes). Each reader is still a full deep agent: the page
// sits in its state filesystem (read_file / grep), its skill is in its prompt, its calls are capped.

import {
  type CheckEvent,
  type Finding,
  type Precheck,
  precheck,
  type RulePage,
  rankFindings,
  type Scheme,
  type Situation,
  SituationSchema,
  schemeById,
  type Verdict,
} from "@beacon/rules";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createDeepAgent, registerHarnessProfile } from "deepagents";
import { createMiddleware } from "langchain";
import {
  type BeamEnv,
  EFFORT,
  LIMITS,
  loadBeamEnv,
  MAX_OUTPUT_TOKENS,
  rulesFile,
} from "./config.ts";
import {
  addUsage,
  NO_USAGE,
  type StepModels,
  stepModels,
  type Usage,
  usageOf,
  withEffortFallback,
} from "./model.ts";
import { JUDGE_PROMPT, readerTask } from "./prompts/judge.ts";
import { schemeSkill } from "./skills.ts";
import {
  loadRules,
  pageFileText,
  RECORD_FINDING,
  recordFindingTool,
} from "./tools.ts";

// Readers only read: no writing, no shell, no general-purpose subagent. Beam is served through
// ChatOpenAI, so the profile is keyed by the "openai" provider.
registerHarnessProfile("openai", {
  excludedTools: [
    "write_file",
    "edit_file",
    "delete",
    "execute",
    "task",
    "write_todos",
  ],
  generalPurposeSubagent: { enabled: false },
});

export interface CheckOptions {
  signal?: AbortSignal;
  /** GOV.UK fetcher (tests inject a fake) */
  fetcher?: typeof fetch;
  /** Replaces Beam for every step (tests, evals) */
  model?: BaseChatModel;
  /** Name reported in `done` when `model` is injected */
  modelName?: string;
  snapshotDir?: string;
  /** Env to read Beam settings from; defaults to process.env */
  env?: Record<string, string | undefined>;
  today?: Date;
}

// Copy the person may see. Plain, warm, no blame.
export const MESSAGES = {
  unreachable:
    "We couldn't reach Beacon's reading service just now. Your answers are safe in this browser, so please try again in a few minutes.",
  pageUnavailable:
    "We couldn't open the official page just now, so we couldn't check this one for you. It's worth checking on GOV.UK.",
  budget:
    "We stopped here to keep your check quick. It's worth checking this one on GOV.UK.",
  unsettled:
    "We read the official page but couldn't settle this one from your answers. It's worth checking on GOV.UK.",
} as const;

export class BudgetExceededError extends Error {
  constructor() {
    super("Spend cap for this check reached");
    this.name = "BudgetExceededError";
  }
}

/** Shared by every reader in one check: model calls and tokens. */
// Readers run in parallel, so each call reserves its largest possible output before it starts and
// settles to the real usage after. The budget can no longer be overshot by calls already in flight.
class Budget {
  calls = 0;
  tokens = 0;
  reserved = 0;
  take(reserve: number = MAX_OUTPUT_TOKENS.judge): void {
    if (
      this.calls >= LIMITS.modelCallsPerCheck ||
      this.tokens + this.reserved + reserve > LIMITS.tokensPerCheck
    )
      throw new BudgetExceededError();
    this.calls += 1;
    this.reserved += reserve;
  }
  settle(u: Usage, reserve: number = MAX_OUTPUT_TOKENS.judge): void {
    this.reserved -= reserve;
    this.tokens += u.inputTokens + u.outputTokens;
  }
}

/** A finding code writes on its own (precheck results, pages it could not read). Never Likely. */
function codeFinding(
  scheme: Scheme,
  verdict: Exclude<Verdict, "likely">,
  why: string,
  page?: RulePage,
): Finding {
  return {
    scheme: scheme.id,
    verdict,
    why,
    quote: "",
    becauseYouSaid: [],
    quoteVerified: false,
    source: page
      ? {
          url: page.url,
          title: page.title,
          readAt: page.readAt,
          publicUpdatedAt: page.publicUpdatedAt,
        }
      : {
          url: `https://www.gov.uk${scheme.govukPaths[0] ?? ""}`,
          title: scheme.name,
          readAt: new Date().toISOString(),
          publicUpdatedAt: "",
        },
  };
}

const settledVerdict = (p: Precheck): Exclude<Verdict, "likely"> =>
  p.status === "already-get" ? "already-get" : "unlikely-right-now";

/** A push queue the readers write to and the generator drains, in arrival order. */
function eventQueue() {
  const buffer: CheckEvent[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  return {
    push(event: CheckEvent): void {
      if (closed) return;
      buffer.push(event);
      wake?.();
    },
    close(): void {
      closed = true;
      wake?.();
    },
    async *drain(): AsyncGenerator<CheckEvent> {
      for (;;) {
        const next = buffer.shift();
        if (next) {
          yield next;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = undefined;
      }
    },
  };
}

async function runPool<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift())
      await work(item);
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

interface ReaderRun {
  scheme: Scheme;
  page: RulePage;
  pre: Precheck;
  situation: Situation;
  models: StepModels;
  budget: Budget;
  signal?: AbortSignal;
  today?: Date;
  onFinding: (f: Finding) => void;
}

/** One rule reader: a deep agent that reads one page and records one finding. Returns its usage. */
async function readScheme(
  run: ReaderRun,
): Promise<{ usage: Usage; recorded: boolean }> {
  let usage = NO_USAGE;
  let calls = 0;
  let recorded = false;
  const control = createMiddleware({
    name: "ReaderControl",
    wrapModelCall: async (request, handler) => {
      run.budget.take();
      calls += 1;
      let u = NO_USAGE;
      try {
        // Every call must use a tool; the last allowed call must record the finding.
        const toolChoice =
          calls >= LIMITS.modelCallsPerScheme
            ? ({
                type: "function",
                function: { name: RECORD_FINDING },
              } as const)
            : ("required" as const);
        const reply = await withEffortFallback(run.models, async (model) =>
          handler({ ...request, model, toolChoice }),
        );
        u = usageOf(reply);
        usage = addUsage(usage, u);
        return reply;
      } finally {
        run.budget.settle(u);
      }
    },
  });
  const agent = createDeepAgent({
    name: `rule-reader-${run.scheme.id}`,
    model: run.models.preferred,
    systemPrompt: `${JUDGE_PROMPT}\n\n${schemeSkill(run.scheme.id)}`,
    tools: [
      recordFindingTool({
        scheme: run.scheme.id,
        page: run.page,
        onFinding: (f) => {
          recorded = true;
          run.onFinding(f);
        },
      }),
    ],
    middleware: [control],
  });
  const now = new Date().toISOString();
  try {
    await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: readerTask(run.scheme, run.pre, run.situation, run.today),
          },
        ],
        files: {
          [rulesFile(run.scheme.id)]: {
            content: pageFileText(run.page),
            mimeType: "text/markdown",
            created_at: now,
            modified_at: now,
          },
        },
      },
      { signal: run.signal, recursionLimit: LIMITS.readerRecursionLimit },
    );
  } catch (error) {
    // The finding may already be out (a failure after record_finding changes nothing).
    if (!recorded) throw Object.assign(error as Error, { usage });
  }
  return { usage, recorded };
}

/**
 * Runs one check and streams it: precheck, plan, settled findings, then reading / finding / usage
 * per open scheme, then done. Every Likely comes through settleFinding. Ends quietly on abort.
 */
export async function* runCheck(
  input: Situation,
  opts: CheckOptions = {},
): AsyncGenerator<CheckEvent> {
  const { signal } = opts;
  if (signal?.aborted) return;
  const situation = SituationSchema.parse(input);
  const items = precheck(situation, opts.today);
  yield { type: "precheck", items };

  const open = items.filter((p) => p.status === "open");
  yield { type: "plan", schemes: open.map((p) => p.scheme) };

  const findings: Finding[] = [];
  for (const p of items.filter((i) => i.status !== "open")) {
    const finding = codeFinding(
      schemeById(p.scheme),
      settledVerdict(p),
      p.reason,
    );
    findings.push(finding);
    yield { type: "finding", finding };
  }

  let env: BeamEnv | undefined;
  try {
    env = loadBeamEnv(opts.env);
  } catch {
    env = undefined;
  }
  const modelName =
    opts.modelName ??
    (opts.model ? opts.model.getName() : (env?.model ?? "beam"));
  let snapshot = false;
  if (open.length === 0) {
    yield {
      type: "done",
      findings: rankFindings(findings),
      model: modelName,
      snapshot,
    };
    return;
  }
  if (!opts.model && !env?.apiKey) {
    yield { type: "error", message: MESSAGES.unreachable };
    return;
  }
  const models = stepModels(env, "judge", opts.model);

  const queue = eventQueue();
  const onAbort = (): void => queue.close();
  signal?.addEventListener("abort", onAbort, { once: true });
  const budget = new Budget();
  let read = 0;
  const failed: Array<{ scheme: Scheme; page: RulePage }> = [];

  const emitFinding = (finding: Finding): void => {
    findings.push(finding);
    queue.push({ type: "finding", finding });
  };

  const work = async (pre: Precheck): Promise<void> => {
    if (signal?.aborted) return;
    const scheme = schemeById(pre.scheme);
    queue.push({ type: "reading", scheme: scheme.id, status: "reading" });
    let page: RulePage;
    try {
      const loaded = await loadRules(scheme.id, {
        fetcher: opts.fetcher,
        snapshotDir: opts.snapshotDir,
      });
      page = loaded.page;
      snapshot ||= loaded.snapshot;
    } catch {
      queue.push({ type: "reading", scheme: scheme.id, status: "failed" });
      emitFinding(
        codeFinding(scheme, "worth-checking", MESSAGES.pageUnavailable),
      );
      return;
    }
    queue.push({
      type: "reading",
      scheme: scheme.id,
      status: "done",
      title: page.title,
      url: page.url,
    });
    if (signal?.aborted) return;

    let usage = NO_USAGE;
    try {
      const result = await readScheme({
        scheme,
        page,
        pre,
        situation,
        models,
        budget,
        signal,
        today: opts.today,
        onFinding: emitFinding,
      });
      usage = result.usage;
      read += 1;
      if (!result.recorded)
        emitFinding(
          codeFinding(scheme, "worth-checking", MESSAGES.unsettled, page),
        );
    } catch (error) {
      usage = (error as { usage?: Usage }).usage ?? NO_USAGE;
      if (signal?.aborted) return;
      if (error instanceof BudgetExceededError) {
        read += 1;
        emitFinding(
          codeFinding(scheme, "worth-checking", MESSAGES.budget, page),
        );
      } else {
        // Name and status only: provider errors can echo prompt text, which holds answers.
        const e = error as { name?: string; status?: number };
        console.error(
          `[brain] rule reader for ${scheme.id} failed: ${e.name ?? "Error"}${e.status ? ` ${e.status}` : ""}`,
        );
        failed.push({ scheme, page });
      }
    } finally {
      if (usage.inputTokens + usage.outputTokens > 0)
        queue.push({
          type: "usage",
          step: "judge",
          effort: EFFORT.judge,
          ...usage,
          scheme: scheme.id,
        });
    }
  };

  const readers = runPool(open, LIMITS.parallelReaders, work).finally(() =>
    queue.close(),
  );
  try {
    for await (const event of queue.drain()) {
      if (signal?.aborted) return;
      yield event;
    }
    await readers;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
  if (signal?.aborted) return;

  // Nothing got through to Beam at all: say so warmly instead of a page of "worth checking".
  if (read === 0 && failed.length > 0) {
    yield { type: "error", message: MESSAGES.unreachable };
    return;
  }
  for (const { scheme, page } of failed) {
    const finding = codeFinding(
      scheme,
      "worth-checking",
      MESSAGES.unsettled,
      page,
    );
    findings.push(finding);
    yield { type: "finding", finding };
  }
  yield {
    type: "done",
    findings: rankFindings(findings),
    model: modelName,
    snapshot,
  };
}

/** Runs a whole check and returns what it streamed (MCP, evals). */
export async function collectCheck(
  situation: Situation,
  opts?: CheckOptions,
): Promise<CheckEvent[]> {
  const events: CheckEvent[] = [];
  for await (const event of runCheck(situation, opts)) events.push(event);
  return events;
}
