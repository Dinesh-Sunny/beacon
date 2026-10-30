// Reads every scheme's GOV.UK pages and writes a dated snapshot to packages/rules/snapshot/, so any
// check or eval run can be reproduced against the exact text Beam read. Fails soft: if GOV.UK cannot be
// reached, the old snapshot stays and the script exits 0 with a warning (the Space build must not break).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES_AS_OF } from "../config.ts";
import { type RulePage, readGovuk } from "../govuk.ts";
import { SCHEMES, type SchemeId } from "../schemes.ts";

export interface SnapshotEntry {
  scheme: SchemeId;
  file: string;
  pages: Array<{
    path: string;
    url: string;
    title: string;
    publicUpdatedAt: string;
    chars: number;
  }>;
}

export interface SnapshotManifest {
  /** When this snapshot was read */
  readAt: string;
  /** The rules config date the snapshot was taken against */
  rulesAsOf: string;
  source: "https://www.gov.uk/api/content";
  schemes: SnapshotEntry[];
  /** Schemes that could not be read this run (their older file, if any, is kept) */
  failed: Array<{ scheme: SchemeId; error: string }>;
}

/** One file per scheme: every page it reads, in order. */
export interface SchemeSnapshot {
  scheme: SchemeId;
  pages: RulePage[];
}

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "snapshot",
);
const TIMEOUT_MS = 15_000;

const timedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

async function readOld(): Promise<SnapshotManifest | null> {
  try {
    return JSON.parse(
      await readFile(join(OUT_DIR, "manifest.json"), "utf8"),
    ) as SnapshotManifest;
  } catch {
    return null;
  }
}

export async function takeSnapshot(
  fetcher: typeof fetch = timedFetch,
  outDir: string = OUT_DIR,
): Promise<SnapshotManifest> {
  await mkdir(outDir, { recursive: true });
  const old = await readOld();
  const manifest: SnapshotManifest = {
    readAt: new Date().toISOString(),
    rulesAsOf: RULES_AS_OF,
    source: "https://www.gov.uk/api/content",
    schemes: [],
    failed: [],
  };

  for (const scheme of SCHEMES) {
    try {
      const pages: RulePage[] = [];
      for (const path of scheme.govukPaths)
        pages.push(await readGovuk(path, fetcher));
      const file = `${scheme.id}.json`;
      const body: SchemeSnapshot = { scheme: scheme.id, pages };
      await writeFile(join(outDir, file), `${JSON.stringify(body, null, 2)}\n`);
      manifest.schemes.push({
        scheme: scheme.id,
        file,
        pages: pages.map((p) => ({
          path: p.path,
          url: p.url,
          title: p.title,
          publicUpdatedAt: p.publicUpdatedAt,
          chars: p.text.length,
        })),
      });
    } catch (err) {
      manifest.failed.push({
        scheme: scheme.id,
        error: err instanceof Error ? err.message : String(err),
      });
      const kept = old?.schemes.find((e) => e.scheme === scheme.id);
      if (kept) manifest.schemes.push(kept);
    }
  }

  // Nothing new was read: leave the old manifest (or no manifest) exactly as it was.
  if (manifest.failed.length === SCHEMES.length) return old ?? manifest;
  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

if (import.meta.main) {
  try {
    const m = await takeSnapshot();
    const ok = SCHEMES.length - m.failed.length;
    console.log(
      `Rules snapshot: ${ok}/${SCHEMES.length} schemes read from GOV.UK into ${OUT_DIR}`,
    );
    for (const f of m.failed)
      console.warn(
        `warning: could not read ${f.scheme} (${f.error}); any older snapshot file is kept`,
      );
  } catch (err) {
    console.warn(
      `warning: rules snapshot skipped, older snapshot kept (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  process.exitCode = 0;
}
