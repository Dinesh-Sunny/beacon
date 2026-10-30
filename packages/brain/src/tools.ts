// The agent's tools and the page loader behind them. Code reads the official page once per check;
// the rule reader sees that same page in its filesystem, and settleFinding checks the quote against
// it, so the model can never quote a page code did not read.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Finding,
  ProposedFindingSchema,
  pageFromContent,
  type RulePage,
  readGovuk,
  SCHEMES,
  type SchemeId,
  schemeById,
  settleFinding,
} from "@beacon/rules";
import { tool } from "langchain";
import { z } from "zod";
import { SNAPSHOT_DIR_ENV } from "./config.ts";

export const SCHEME_IDS = SCHEMES.map((s) => s.id) as [SchemeId, ...SchemeId[]];
export const SchemeIdSchema = z.enum(SCHEME_IDS);

export class RulesUnavailableError extends Error {
  readonly scheme: SchemeId;
  constructor(scheme: SchemeId, cause: unknown) {
    super(`Could not read the rules for ${scheme} live or from the snapshot`, {
      cause,
    });
    this.name = "RulesUnavailableError";
    this.scheme = scheme;
  }
}

export interface ReadOptions {
  fetcher?: typeof fetch;
  /** Folder of <scheme>.json snapshots; defaults to packages/rules/snapshot */
  snapshotDir?: string;
}

export interface LoadedRules {
  page: RulePage;
  /** True when the live read failed and the dated snapshot was used */
  snapshot: boolean;
}

function defaultSnapshotDir(): string | undefined {
  const fromEnv = process.env[SNAPSHOT_DIR_ENV];
  if (fromEnv) return fromEnv;
  try {
    // packages/rules/src/index.ts -> packages/rules/snapshot
    return join(
      dirname(fileURLToPath(import.meta.resolve("@beacon/rules"))),
      "..",
      "snapshot",
    );
  } catch {
    return undefined;
  }
}

/** Several guide pages read as one: each keeps its own heading, the first gives the link. */
function joinPages(pages: RulePage[]): RulePage {
  const [first, ...rest] = pages;
  if (!first) throw new Error("No pages to join");
  if (rest.length === 0) return first;
  return {
    ...first,
    text: pages.map((p) => `# ${p.title}\n${p.url}\n\n${p.text}`).join("\n\n"),
  };
}

const SnapshotPage = z.object({
  path: z.string(),
  url: z.string(),
  title: z.string(),
  text: z.string(),
  publicUpdatedAt: z.string(),
  readAt: z.string(),
});
// A snapshot file holds one page, a list, or { pages } (written by the rules snapshot script).
const SnapshotFile = z.union([
  SnapshotPage,
  z.array(SnapshotPage).min(1),
  z.object({ pages: z.array(SnapshotPage).min(1) }),
]);

async function readSnapshot(
  scheme: SchemeId,
  dir: string | undefined,
): Promise<RulePage> {
  if (!dir) throw new Error("No snapshot folder");
  const parsed = SnapshotFile.parse(
    JSON.parse(await readFile(join(dir, `${scheme}.json`), "utf8")),
  );
  return joinPages(
    Array.isArray(parsed)
      ? parsed
      : "pages" in parsed
        ? parsed.pages
        : [parsed],
  );
}

/** Reads a scheme's official pages live, falling back to the dated snapshot. */
export async function loadRules(
  scheme: SchemeId,
  opts: ReadOptions = {},
): Promise<LoadedRules> {
  const { govukPaths } = schemeById(scheme);
  try {
    const pages = await Promise.all(
      govukPaths.map((path) => readGovuk(path, opts.fetcher ?? fetch)),
    );
    return { page: joinPages(pages), snapshot: false };
  } catch (liveError) {
    try {
      return {
        page: await readSnapshot(
          scheme,
          opts.snapshotDir ?? defaultSnapshotDir(),
        ),
        snapshot: true,
      };
    } catch {
      throw new RulesUnavailableError(scheme, liveError);
    }
  }
}

/** A page as the reader sees it in its filesystem: title and link first, then the text. */
export const pageFileText = (page: RulePage): string =>
  `# ${page.title}\nSource: ${page.url}\nLast changed on GOV.UK: ${page.publicUpdatedAt || "unknown"}\n\n${page.text}\n`;

// Re-exported so callers and tests can build pages from Content API JSON.
export { pageFromContent };

export const listSchemesTool = tool(
  async () =>
    JSON.stringify(
      SCHEMES.map((s) => ({
        id: s.id,
        name: s.name,
        runBy: s.runBy,
        summary: s.summary,
        nations: s.nations,
      })),
    ),
  {
    name: "list_schemes",
    description:
      "List the kinds of support Beacon reads, with their ids, who runs them and where they apply.",
    schema: z.object({}),
  },
);

export const GetRulesInput = z.object({
  scheme: SchemeIdSchema.describe("Scheme id from list_schemes"),
});

/** Reads one scheme's official page and returns its text with title and link. */
export function getRulesTool(opts: ReadOptions = {}) {
  return tool(
    async ({ scheme }) => {
      const { page, snapshot } = await loadRules(scheme, opts);
      return `${pageFileText(page)}${snapshot ? `\n(From Beacon's dated snapshot, read ${page.readAt})\n` : ""}`;
    },
    {
      name: "get_rules",
      description:
        "Read the official GOV.UK page for one kind of support. Returns the page title, link and full text.",
      schema: GetRulesInput,
    },
  );
}

/** Where a reader's record_finding lands: code settles it against the page code read. */
export interface FindingSink {
  scheme: SchemeId;
  page: RulePage;
  onFinding: (finding: Finding) => void;
}

// The model sometimes copies read_file's "    12\t" line prefix into a quote; it is not wording.
const LINE_PREFIX = /^\s*\d+(?:\.\d+)?\t/;
export const stripLinePrefix = (quote: string): string =>
  quote.replace(LINE_PREFIX, "").trim();

export const RECORD_FINDING = "record_finding";

/**
 * The only way a verdict leaves the model. Code runs settleFinding (no verified quote, no Likely)
 * and emits the settled finding; the reader stops after it (returnDirect).
 */
export function recordFindingTool(sink: FindingSink) {
  let recorded = false;
  return tool(
    async (proposed) => {
      if (recorded) return "Already recorded for this scheme.";
      recorded = true;
      const finding = settleFinding(
        {
          ...proposed,
          scheme: sink.scheme,
          quote: stripLinePrefix(proposed.quote),
        },
        sink.scheme,
        sink.page,
      );
      sink.onFinding(finding);
      return `Recorded: ${finding.verdict}${finding.quoteVerified ? "" : " (quote not found on the page)"}.`;
    },
    {
      name: RECORD_FINDING,
      description:
        "Record your one finding for this kind of support. Call it exactly once, after reading the page. The quote must be one sentence copied word for word from the page, without line numbers.",
      schema: ProposedFindingSchema,
      returnDirect: true,
    },
  );
}
