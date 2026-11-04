// Harvests support data from every connector (or the ones named) into catalog/.
// Usage: node scripts/harvest.ts [govuk ...]
import { harvest } from "../src/knowledge/harvest.ts";

const status = await harvest(process.cwd(), process.argv.slice(2));
for (const [id, c] of Object.entries(status.connectors))
  console.log(
    `${id}: ${c.state}${c.items !== undefined ? `, ${c.items} items` : ""}${c.error ? `, ${c.error}` : ""}`,
  );
