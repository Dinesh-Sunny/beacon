// Builds catalog/coverage.html: one page showing what Beacon covers and connects to, laid out
// like the Beacon Framework (people left, help right, Beacon in the middle). Generated from the
// packs, the coverage catalogue, the harvest, triage and draft review, so it is never hand-kept.
// Usage: node scripts/coverage-page.ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import { FACTS } from "../src/engine/facts.ts";
import { PackSchema } from "../src/engine/pack.ts";

const read = async <T>(f: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(f, "utf8")) as T;
  } catch {
    return fallback;
  }
};
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

interface Conn {
  name: string;
  kind: string;
  url: string;
  access: string;
  covers: string;
  notes?: string;
}
interface Provider {
  id: string;
  label: string;
  phase: number;
  scale: number | string | null;
  scaleSource: string | null;
  live: string[];
  next: {
    id: string;
    name: string;
    nation: string[];
    url: string;
    checked: string | null;
  }[];
  connectors: Conn[];
}
interface Coverage {
  version: string;
  people: {
    id: string;
    label: string;
    phase: number;
    facts: string[];
    missingFacts: string[];
  }[];
  providers: Provider[];
  strategy: {
    group: string;
    provider: string;
    why: string;
    schemesEstimate: string;
    connector: string;
  }[];
}

const files = (await readdir("packs")).filter((f) => /^[a-z-]+\.json$/.test(f));
const packs = await Promise.all(
  files.map(async (f) =>
    PackSchema.parse(JSON.parse(await readFile(`packs/${f}`, "utf8"))),
  ),
);
const cov = await read<Coverage>("catalog/coverage.json", {
  version: "",
  people: [],
  providers: [],
  strategy: [],
});
const sources = await read<Record<string, unknown>>(
  "catalog/sources/index.json",
  {},
);
const triage = await read<
  Record<
    string,
    { support: boolean; provider: string | null; people: string[] }
  >
>("catalog/harvest/triage.json", {});
const reviewed = await read<{
  counts: Record<string, number>;
  roadmap: { fact: string; unlocks: number; alsoNeeds: number }[];
  rows: { provider: string; status: string }[];
}>("catalog/drafts/review.json", { counts: {}, roadmap: [], rows: [] });

const live = packs.reduce((n, p) => n + p.schemes.length, 0);
const help = Object.values(triage).filter((t) => t.support);
const found = (pid: string) => help.filter((t) => t.provider === pid).length;
const foundFor = (gid: string) =>
  help.filter((t) => t.people.includes(gid)).length;
const ready = (pid: string) =>
  reviewed.rows.filter((r) => r.provider === pid && r.status === "ready")
    .length;
const today = new Date().toISOString().slice(0, 10);
const phase1 = (x: { phase: number }) => x.phase === 1;
const connectors = cov.providers.flatMap((p) =>
  p.connectors.map((c) => ({ ...c, provider: p.label })),
);
const uniqConn = [...new Map(connectors.map((c) => [c.name, c])).values()];

const stat = (v: number | string, k: string) =>
  `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`;
const bar = (n: number, max: number, cls: string) =>
  `<i class="${cls}" style="width:${max ? Math.max(2, (n / max) * 100) : 0}%"></i>`;
const maxP = Math.max(
  1,
  ...cov.providers.map((p) => p.live.length + found(p.id) + p.next.length),
);

const html = `<title>Beacon Coverage</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: the Framework's three columns (people, Beacon, help) on top, then per-provider coverage rows, then the pipeline's backlog. */
:root{--bg:#F4EFE7;--surface:#FFFDF9;--ink:#1F1B16;--muted:#6B6257;--line:#E2D9CC;--amber:#D9900F;--amber-soft:rgba(217,144,15,.16);--good:#2E7D4F;--good-soft:rgba(46,125,79,.14);--sea:#2B6A7E;--sea-soft:rgba(43,106,126,.12);--check:#B5541B;
--display:"Fraunces",Georgia,serif;--body:"Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17140F;--surface:#221E18;--ink:#F1EBE1;--muted:#B3A898;--line:#3A332A;--amber:#F0B347;--amber-soft:rgba(240,179,71,.16);--good:#6CC48F;--good-soft:rgba(108,196,143,.14);--sea:#6BB6CB;--sea-soft:rgba(107,182,203,.14);--check:#E58B55;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#17140F;--surface:#221E18;--ink:#F1EBE1;--muted:#B3A898;--line:#3A332A;--amber:#F0B347;--amber-soft:rgba(240,179,71,.16);--good:#6CC48F;--good-soft:rgba(108,196,143,.14);--sea:#6BB6CB;--sea-soft:rgba(107,182,203,.14);--check:#E58B55;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:17px/1.55 var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 64px}
.wrap{max-width:1160px;margin:0 auto;display:flex;flex-direction:column;gap:56px}
h1,h2,h3{font-family:var(--display);margin:0;line-height:1.1;text-wrap:balance}
h1{font-size:clamp(2.2rem,5vw,3.4rem)}h2{font-size:clamp(1.4rem,3vw,1.9rem)}h3{font-size:1.05rem}
p{margin:0;max-width:68ch}
.eyebrow{font:500 .75rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.lede{color:var(--muted)}
section{display:flex;flex-direction:column;gap:18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.stat{background:var(--surface);padding:14px 16px;display:flex;flex-direction:column}
.stat b{font:700 1.7rem var(--display);font-variant-numeric:tabular-nums}.stat span{color:var(--muted);font-size:.88rem}
.frame{display:grid;grid-template-columns:minmax(0,1fr) 220px minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:900px){.frame{grid-template-columns:1fr}}
.col{display:flex;flex-direction:column;gap:8px;min-width:0}
.col>.eyebrow.p{color:var(--sea)}.col>.eyebrow.h{color:var(--good)}
.pill{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center}
.pill .n{font:500 .8rem var(--mono);color:var(--muted);font-variant-numeric:tabular-nums;text-align:right}
.pill small{grid-column:1/-1;color:var(--muted);font-size:.85rem}
.lamp{background:var(--surface);border:1.5px solid var(--amber);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;position:sticky;top:16px}
.lamp b{font:700 1.2rem var(--display)}
.lamp ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:.92rem}
.lamp li span{color:var(--muted);font:500 .78rem var(--mono)}
.rows{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) 220px;gap:16px;padding:14px 0;border-bottom:1px solid var(--line);align-items:start}
@media (max-width:760px){.row{grid-template-columns:1fr}}
.meter{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--line);margin-top:6px}
.meter i{display:block;height:100%}.meter .live{background:var(--good)}.meter .found{background:var(--amber)}.meter .next{background:var(--sea)}
.key{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--muted)}
.key i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.counts{font:500 .8rem var(--mono);color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chips a,.chips span{font-size:.82rem;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none;background:var(--surface)}
.chips a.ok{border-color:var(--good)}
.chips a:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.conn{font-size:.85rem;color:var(--muted);display:flex;flex-direction:column;gap:4px}
.conn b{color:var(--ink);font-weight:700}
.tbl{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 .72rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
tr:last-child td{border-bottom:0}
td.num{font-variant-numeric:tabular-nums;text-align:right}
.acc{font:500 .75rem var(--mono);padding:2px 8px;border-radius:999px;border:1px solid var(--line)}
.acc.open{border-color:var(--good);color:var(--good)}.acc.licence{border-color:var(--check);color:var(--check)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;counter-reset:s}
.step{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.step b{font-variant-numeric:tabular-nums}.step span{font-size:.88rem;color:var(--muted)}
a{color:var(--ink)}
.foot{color:var(--muted);font-size:.88rem;border-top:1px solid var(--line);padding-top:16px}
</style>
<div class="wrap">
  <header style="display:flex;flex-direction:column;gap:14px">
    <span class="eyebrow">Beacon Framework · coverage on ${today}</span>
    <h1>Beacon Coverage</h1>
    <p class="lede">What Beacon checks today, what it has already found, and where the next thousands of schemes come from. People who need help on the left, everyone who gives help on the right, Beacon in the middle. Generated from the rule packs, the coverage catalogue and the harvest.</p>
    <div class="stats">${[
      stat(live, "kinds of help live in checks"),
      stat(packs.length, "rule packs"),
      stat(
        Object.keys(sources).length.toLocaleString("en-GB"),
        "official pages stored",
      ),
      stat(help.length, "pages marked as help"),
      stat(reviewed.counts.ready ?? 0, "drafts ready to review"),
      stat(uniqConn.length, "data connectors mapped"),
    ].join("")}</div>
  </header>

  <section aria-labelledby="map-h">
    <span class="eyebrow">1 · The map</span>
    <h2 id="map-h">People, Beacon, help</h2>
    <div class="frame">
      <div class="col"><span class="eyebrow p">People who need help</span>
        ${cov.people
          .filter(phase1)
          .map(
            (g) =>
              `<div class="pill"><b>${esc(g.label)}</b><span class="n">${foundFor(g.id)} found</span><small>Asks: ${esc(g.facts.map((f) => (FACTS as Record<string, { label: string }>)[f]?.label.toLowerCase() ?? f).join(", "))}${g.missingFacts.length ? ` · next: ${esc(g.missingFacts.length)} new questions` : ""}</small></div>`,
          )
          .join("")}
      </div>
      <div class="lamp"><b>Beacon</b><span class="eyebrow">How help gets in</span>
        <ol>
          <li>Harvest <span>${uniqConn.length} connectors</span></li>
          <li>Store once <span>${Object.keys(sources).length} pages</span></li>
          <li>Triage, Muse Spark <span>${Object.keys(triage).length} sorted</span></li>
          <li>Draft, Muse Spark <span>${reviewed.rows.length} drafts</span></li>
          <li>Review by code <span>${reviewed.counts.ready ?? 0} ready</span></li>
          <li>Rule pack <span>${live} live</span></li>
        </ol>
      </div>
      <div class="col"><span class="eyebrow h">Who helps</span>
        ${cov.providers
          .filter(phase1)
          .map(
            (p) =>
              `<div class="pill"><b>${esc(p.label.replace(/ \\(.*\\)$/, ""))}</b><span class="n">${p.live.length} live</span><small>${found(p.id)} found in harvest · ${p.next.length} next · ${p.connectors.length} sources</small></div>`,
          )
          .join("")}
      </div>
    </div>
  </section>

  <section aria-labelledby="prov-h">
    <span class="eyebrow">2 · By provider</span>
    <h2 id="prov-h">Live, found and next for every provider</h2>
    <div class="key"><span><i style="background:var(--good)"></i>Live in checks</span><span><i style="background:var(--amber)"></i>Found in the harvest</span><span><i style="background:var(--sea)"></i>Next, from official pages</span></div>
    <div class="rows">
    ${cov.providers
      .map(
        (p) => `<div class="row">
        <div><h3>${esc(p.label)}</h3><div class="meter" aria-hidden="true">${bar(p.live.length, maxP, "live")}${bar(found(p.id), maxP, "found")}${bar(p.next.length, maxP, "next")}</div>
          <div class="counts"><span>${p.live.length} live</span><span>${found(p.id)} found</span><span>${ready(p.id)} ready</span><span>${p.next.length} next</span>${p.scale ? `<span>~${esc(p.scale)} in the UK</span>` : ""}</div></div>
        <div class="chips">${p.next.map((n) => `<a href="${esc(n.url)}" target="_blank" rel="noreferrer" class="${n.checked ? "ok" : ""}" title="${n.checked ? `Checked ${esc(n.checked)}` : "Not checked yet"}">${esc(n.name)}</a>`).join("") || `<span>Phase ${p.phase}</span>`}</div>
        <div class="conn">${p.connectors.map((c) => `<span><b>${esc(c.name)}</b> · <span class="acc ${esc(c.access)}">${esc(c.access)}</span></span>`).join("") || "<span>No source mapped yet</span>"}</div>
      </div>`,
      )
      .join("")}
    </div>
  </section>

  <section aria-labelledby="road-h">
    <span class="eyebrow">3 · Questions to add</span>
    <h2 id="road-h">Which new question unlocks the most help</h2>
    <p class="lede">From Muse Spark's drafts: each draft lists what it needs that Beacon doesn't ask yet. "Unlocks" counts drafts that need only that one question.</p>
    <div class="tbl"><table><thead><tr><th>Question</th><th class="num">Unlocks</th><th class="num">Also needed by</th></tr></thead><tbody>
    ${
      reviewed.roadmap
        .slice(0, 15)
        .map(
          (r) =>
            `<tr><td>${esc(r.fact)}</td><td class="num">${r.unlocks}</td><td class="num">${r.alsoNeeds}</td></tr>`,
        )
        .join("") || '<tr><td colspan="3">Drafts still running</td></tr>'
    }
    </tbody></table></div>
  </section>

  <section aria-labelledby="next-h">
    <span class="eyebrow">4 · The next ten groups</span>
    <h2 id="next-h">The order to reach thousands of schemes</h2>
    <div class="tbl"><table><thead><tr><th>Group</th><th>Provider</th><th>Why now</th><th>Scale</th><th>Source</th></tr></thead><tbody>
    ${cov.strategy.map((s) => `<tr><td>${esc(s.group)}</td><td>${esc(s.provider)}</td><td>${esc(s.why)}</td><td>${esc(s.schemesEstimate)}</td><td>${esc(s.connector)}</td></tr>`).join("")}
    </tbody></table></div>
  </section>

  <section aria-labelledby="conn-h">
    <span class="eyebrow">5 · Connectors</span>
    <h2 id="conn-h">Where the data comes from</h2>
    <div class="tbl"><table><thead><tr><th>Source</th><th>Kind</th><th>Access</th><th>What it gives Beacon</th></tr></thead><tbody>
    ${uniqConn.map((c) => `<tr><td><a href="${esc(c.url)}" target="_blank" rel="noreferrer">${esc(c.name)}</a></td><td>${esc(c.kind)}</td><td><span class="acc ${esc(c.access)}">${esc(c.access)}</span></td><td>${esc(c.covers)}</td></tr>`).join("")}
    </tbody></table></div>
  </section>

  <p class="foot">Nothing here reaches a person until it passes the rule pack schema and review. Live checks run on the last good packs while new data is harvested in the background. Built from apps/meta/catalog in the Beacon repo.</p>
</div>`;
await writeFile("catalog/coverage.html", html);
console.log(
  `catalog/coverage.html: ${live} live, ${help.length} found, ${uniqConn.length} connectors`,
);
