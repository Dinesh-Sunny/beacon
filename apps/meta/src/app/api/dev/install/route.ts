// Development only: runs `pnpm install --frozen-lockfile` on the machine running the dev server,
// so a new dependency in the lockfile can be installed for that machine's own platform after a
// pull. Off in production.
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { json } from "@/server/http";

export const runtime = "nodejs";
const run = promisify(execFile);

export async function POST() {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  const pnpm = process.env.npm_execpath;
  if (!pnpm || !/pnpm/.test(pnpm))
    return json({ error: "dev server was not started with pnpm" }, 400);
  try {
    // pnpm may be a script (run with node) or a standalone binary (run directly).
    const [cmd, args] = /\.(c|m)?js$/.test(pnpm)
      ? [process.execPath, [pnpm]]
      : [pnpm, []];
    const { stdout, stderr } = await run(
      cmd,
      [...args, "install", "--frozen-lockfile"],
      { cwd: path.resolve(process.cwd(), "../.."), timeout: 300_000 },
    );
    return json({ ok: true, out: `${stdout}\n${stderr}`.slice(-2000) });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message.slice(-2000) }, 500);
  }
}
