// Keeps src/data/data-counts.json: the size of each live dataset, written by its builder, so
// pages can quote real numbers without loading the datasets themselves.
import { readFile, writeFile } from "node:fs/promises";

const FILE = "src/data/data-counts.json";

export async function setCount(key: string, value: Record<string, unknown>) {
  const all = JSON.parse(
    await readFile(FILE, "utf8").catch(() => "{}"),
  ) as Record<string, unknown>;
  all[key] = value;
  await writeFile(FILE, `${JSON.stringify(all, null, 1)}\n`);
}
