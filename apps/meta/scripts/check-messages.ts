// Checks every language file against English: the same keys, and every message a valid ICU
// message (placeholders, plurals and <link> tags), parsed by the same library use-intl uses.
// Usage: node scripts/check-messages.ts
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { IntlMessageFormat } = require(
  require.resolve("intl-messageformat", {
    paths: [require.resolve("use-intl")],
  }),
) as typeof import("intl-messageformat");

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ""): Map<string, string> =>
  new Map(
    Object.entries(t).flatMap(([k, v]) =>
      typeof v === "string" ? [[p + k, v]] : [...flat(v, `${p + k}.`)],
    ),
  );
const load = async (l: string) =>
  flat(
    JSON.parse(await readFile(`src/i18n/messages/${l}.json`, "utf8")) as Tree,
  );

const en = await load("en");
let bad = 0;
for (const l of ["en", "cy", "pl", "es", "bn", "ur", "ar"]) {
  const m = await load(l);
  const missing = [...en.keys()].filter((k) => !m.has(k));
  const extra = [...m.keys()].filter((k) => !en.has(k));
  const broken = [...m].filter(([, v]) => {
    try {
      new IntlMessageFormat(v, l);
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length || extra.length || broken.length) bad++;
  console.log(
    `${l}: ${m.size} keys${missing.length ? `, missing ${missing.length} (${missing.slice(0, 3).join(", ")})` : ""}${extra.length ? `, extra ${extra.join(", ")}` : ""}${broken.length ? `, broken ${broken.map(([k]) => k).join(", ")}` : ""}`,
  );
}
process.exitCode = bad ? 1 : 0;
