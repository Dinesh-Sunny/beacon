// Validates every rule pack and the merged registry (ids, lines, topics, cross-pack references).
// Usage: node scripts/check-packs.ts
import { readdir, readFile } from "node:fs/promises";
import { RegistrySchema } from "../src/engine/pack.ts";

const files = (await readdir("packs")).filter((f) => /^[a-z-]+\.json$/.test(f));
const raw = await Promise.all(
  files.map(async (f) => JSON.parse(await readFile(`packs/${f}`, "utf8"))),
);
const r = RegistrySchema.safeParse(raw);
if (!r.success) {
  for (const i of r.error.issues)
    console.error(`- ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
console.log(
  `${r.data.packs.length} packs, ${r.data.schemes.length} schemes, ${r.data.topics.length} topics: ok`,
);
