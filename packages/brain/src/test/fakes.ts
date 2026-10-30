// Test doubles: a Beam stand-in that reads the page file then records a scripted finding, and a
// GOV.UK Content API stand-in.

import type { ProposedFinding, SchemeId } from "@beacon/rules";
import type { BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { rulesFile } from "../config.ts";

export type Script = Omit<ProposedFinding, "scheme"> | "throw";

export interface FakeLog {
  calls: Array<{ scheme: string; toolChoice: unknown; sawPage: boolean }>;
}

export class FakeBeam extends BaseChatModel {
  readonly scripts: Partial<Record<SchemeId, Script>>;
  readonly delayMs: number;
  readonly log: FakeLog;
  readonly toolChoice: unknown;

  constructor(
    scripts: Partial<Record<SchemeId, Script>>,
    opts: { delayMs?: number; log?: FakeLog; toolChoice?: unknown } = {},
  ) {
    super({} as BaseChatModelParams);
    this.scripts = scripts;
    this.delayMs = opts.delayMs ?? 0;
    this.log = opts.log ?? { calls: [] };
    this.toolChoice = opts.toolChoice;
  }

  _llmType(): string {
    return "fake-beam";
  }

  override bindTools(
    _tools: unknown[],
    kwargs?: { tool_choice?: unknown },
  ): FakeBeam {
    return new FakeBeam(this.scripts, {
      delayMs: this.delayMs,
      log: this.log,
      toolChoice: kwargs?.tool_choice,
    });
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
  ): Promise<ChatResult> {
    if (this.delayMs)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.delayMs);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("Aborted"));
        });
      });
    const task = messages.map((m) => m.text).join("\n");
    const scheme = /\(id: ([a-z-]+)\)/.exec(task)?.[1] as SchemeId | undefined;
    if (!scheme) throw new Error("fake: no scheme in task");
    const toolResults = messages.filter((m) => ToolMessage.isInstance(m));
    const sawPage = toolResults.some((m) =>
      m.text.includes("Source: https://www.gov.uk"),
    );
    this.log.calls.push({ scheme, toolChoice: this.toolChoice, sawPage });
    const script = this.scripts[scheme];
    if (script === "throw" || script === undefined)
      throw Object.assign(new Error("connect ECONNREFUSED"), {
        status: undefined,
      });
    const call =
      toolResults.length === 0
        ? {
            name: "read_file",
            args: { file_path: rulesFile(scheme), limit: 400 },
            id: `read-${scheme}`,
            type: "tool_call" as const,
          }
        : {
            name: "record_finding",
            args: { scheme, ...script },
            id: `rec-${scheme}`,
            type: "tool_call" as const,
          };
    const message = new AIMessage({
      content: "",
      tool_calls: [call],
      usage_metadata: {
        input_tokens: 100,
        output_tokens: 10,
        total_tokens: 110,
      },
    });
    return { generations: [{ text: "", message }] };
  }
}

/** Content API JSON for a path, from a map of path -> HTML body. Unknown paths answer 404. */
export function fakeGovuk(bodies: Record<string, string>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const path = url.replace("https://www.gov.uk/api/content", "");
    const body = bodies[path];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(
      JSON.stringify({
        title: `Title for ${path}`,
        base_path: path,
        public_updated_at: "2026-10-01T00:00:00Z",
        details: { body },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}
