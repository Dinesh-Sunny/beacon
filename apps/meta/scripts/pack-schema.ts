// Writes packs/pack.schema.json from the zod schema, so editors check pack files as you type.
// Usage: node scripts/pack-schema.ts
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { PackSchema } from "../src/engine/pack.ts";

const schema = z.toJSONSchema(PackSchema, {
  io: "input",
  unrepresentable: "any",
});
await writeFile(
  new URL("../packs/pack.schema.json", import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
);
console.log("packs/pack.schema.json written");
