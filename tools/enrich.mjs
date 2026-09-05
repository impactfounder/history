/**
 * 중요도 프록시 — QID의 언어판 수 (data-model §4-3, 2026-09-05 A-15).
 *
 * LLM 초안이 없어졌으니 importance_auto를 기계로 정해야 한다. 프록시는
 * "그 항목이 몇 개 언어판 위키백과에 있는가"다 — 여러 언어가 따로 항목을
 * 만든 사건일수록 밖에서 보이는 사건이다. 정확한 척도는 아니고 정렬용이다.
 *
 * 수집기(tools/collect.mjs)는 sitelinks를 ko·en·ja·zh 4개로 걸러 받으므로
 * 여기서 QID만 모아 전체 sitelinks를 다시 받는다. 결과는
 * curation/raw/_qid-sitelinks.json 에 캐시(gitignore). 이미 있는 QID는 건너뛴다.
 *
 * 사용:  MVMT_CONTACT=you@example.com node tools/enrich.mjs [--refresh]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-collector/0.1 (research; ${CONTACT})`;
const OUT = "curation/raw/_qid-sitelinks.json";
const refresh = process.argv.includes("--refresh");

/** 언어판이 아닌 사이트링크 — 세지 않는다. */
const NOT_LANG = new Set([
  "commonswiki", "metawiki", "specieswiki", "wikidatawiki", "incubatorwiki", "mediawikiwiki",
  "outreachwiki", "sourceswiki", "wikifunctionswiki", "wikimaniawiki", "testwiki", "test2wiki",
  "foundationwiki", "nostalgiawiki", "loginwiki", "votewiki",
]);
const isLangWiki = (site) => /^[a-z_-]+wiki$/.test(site) && !NOT_LANG.has(site);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params, tries = 4) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429) { await sleep(Number(res.headers.get("retry-after")) * 1000 || 1500 * 2 ** i); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }
  throw new Error(`429 반복 — ${url}`);
}

// ── QID 모으기 ──────────────────────────────────────────────────────────────
const qids = new Set();
for (const region of readdirSync("curation/raw", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const f = path.join("curation/raw", region, "candidates.jsonl");
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const q = JSON.parse(line).qid;
    if (q) qids.add(q);
  }
}
const cache = existsSync(OUT) && !refresh ? JSON.parse(readFileSync(OUT, "utf8")) : { fetchedAt: null, counts: {} };
const todo = [...qids].filter((q) => !(q in cache.counts));
console.log(`QID ${qids.size}개 · 캐시 ${qids.size - todo.length} · 조회 ${todo.length}`);

// ── 조회 ────────────────────────────────────────────────────────────────────
/** Wikidata 시간값 → {y, m?, d?}. 연도 0이 없으므로 -0057 = BC 57 = 천문학적 -56. precision 9=년 10=월 11=일 */
function timeOf(claims, prop) {
  const list = (claims?.[prop] ?? []).filter((c) => c.mainsnak?.datavalue?.value?.time);
  if (!list.length) return null;
  const c = list.find((x) => x.rank === "preferred") ?? list[0];
  const v = c.mainsnak.datavalue.value;
  const m = /^([+-]\d+)-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return null;
  const y = Number(m[1]);
  const out = { y: y < 0 ? y + 1 : y };
  if (v.precision >= 10 && Number(m[2])) out.m = Number(m[2]);
  if (v.precision >= 11 && Number(m[3])) out.d = Number(m[3]);
  return out;
}
cache.facts ??= {};
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50);
  // claims까지 받는다 — 기간(P580 시작·P582 끝), 시점(P585), 사람 여부(P31=Q5). 기간 막대와 월·일 보강에 쓴다
  const j = await api({ action: "wbgetentities", ids: batch.join("|"), props: "sitelinks|claims" });
  for (const [qid, ent] of Object.entries(j.entities ?? {})) {
    cache.counts[qid] = ent.missing !== undefined ? 0 : Object.keys(ent.sitelinks ?? {}).filter(isLangWiki).length;
    if (ent.missing !== undefined) continue;
    const start = timeOf(ent.claims, "P580"), end = timeOf(ent.claims, "P582"), point = timeOf(ent.claims, "P585");
    const types = (ent.claims?.P31 ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    const human = types.includes("Q5");
    if (start || end || point || types.length) cache.facts[qid] = { ...(start ? { start } : {}), ...(end ? { end } : {}), ...(point ? { point } : {}), ...(human ? { human: true } : {}), ...(types.length ? { types } : {}) };
  }
  cache.fetchedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(cache));
  process.stdout.write(`\r  ${Math.min(i + 50, todo.length)}/${todo.length}`);
  await sleep(200);
}
console.log();

// ── 분포 ────────────────────────────────────────────────────────────────────
const vals = Object.values(cache.counts).sort((a, b) => a - b);
const q = (p) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
console.log(`언어판 수 분포 (n=${vals.length}): min ${vals[0]} · p25 ${q(0.25)} · p50 ${q(0.5)} · p75 ${q(0.75)} · p90 ${q(0.9)} · p97 ${q(0.97)} · max ${vals.at(-1)}`);
