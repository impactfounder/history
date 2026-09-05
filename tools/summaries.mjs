/**
 * 설명 — 한국어 위키백과 첫 문단(대표 지적 2026-09-05: "연표라면 설명이 있어야").
 *
 * 사건에 QID가 있으면 ko 사이트링크 표제어가 있다(약 2,200개). 그 문서의 요약(첫 문단)을
 * ko.wikipedia REST API에서 받아 curation/summaries/ko.jsonl 에 쌓는다. 원문 그대로, CC BY-SA 4.0,
 * 출처(문서 URL·판) 표기 — editorial-policy §1-6과 같은 규칙이다. LLM 없이 한국어 설명이 생긴다.
 * 표제어가 인물·왕조일 때는 인물 설명이 붙는다 — UI는 "관련 문서"라고 부른다.
 *
 * 사용:  node tools/summaries.mjs [--refresh]   (재실행은 캐시에 없는 표제어만)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-collector/0.1 (research; ${CONTACT})`;
const CACHE = "curation/summaries/ko.jsonl";
const refresh = process.argv.includes("--refresh");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync("curation/summaries", { recursive: true });
const cached = new Set(existsSync(CACHE) && !refresh ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).title) : []);

const titles = new Set();
for (const region of ["kr", "cn", "jp", "us"]) {
  const f = `curation/events/${region}.jsonl`;
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status === "published" && r.names_native?.ko) titles.add(r.names_native.ko);
  }
}
const todo = [...titles].filter((t) => !cached.has(t));
console.log(`표제어 ${titles.size} · 캐시 ${cached.size} · 조회 ${todo.length}`);

let ok = 0, missing = 0, failed = 0;
/**
 * 액션 API extracts — 한 요청에 20개 표제어(exintro 상한). REST summary는 건당 요청이라 2,164건이면
 * 429에 걸리며 한 시간이 걸렸다. 109번이면 끝난다.
 */
async function fetchBatch(batch) {
  const url = `https://ko.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    titles: batch.join("|"),
    prop: "extracts|pageprops|revisions|description", exintro: "1", explaintext: "1", exlimit: "20", ppprop: "disambiguation", rvprop: "ids",
  })}`;
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 429) { await sleep(Number(res.headers.get("retry-after")) * 1000 || 3000 * 2 ** attempt); continue; }
      break;
    } catch { await sleep(1000 * 2 ** attempt); }
  }
  if (!res?.ok) { failed += batch.length; return; }
  const q = (await res.json()).query ?? {};
  // 요청한 표제어 → 응답 문서 제목(정규화·넘겨주기 반영)
  const to = new Map();
  for (const n of q.normalized ?? []) to.set(n.from, n.to);
  for (const r of q.redirects ?? []) to.set(r.from, r.to);
  const resolve = (t) => { let x = t; for (let i = 0; i < 3 && to.has(x); i++) x = to.get(x); return x; };
  const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
  const at = new Date().toISOString();
  for (const title of batch) {
    const p = pages.get(resolve(title));
    if (!p || p.missing || p.pageprops?.disambiguation !== undefined || !p.extract?.trim()) {
      appendFileSync(CACHE, JSON.stringify({ title, missing: true, ...(p?.pageprops?.disambiguation !== undefined ? { disambiguation: true } : {}), at }) + "\n");
      missing++;
      continue;
    }
    appendFileSync(
      CACHE,
      JSON.stringify({
        title,
        extract: p.extract.trim(),
        description: p.description ?? null,
        url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
        revid: p.revisions?.[0]?.revid ?? null,
        at,
      }) + "\n",
    );
    ok++;
  }
}
for (let i = 0; i < todo.length; i += 20) {
  await fetchBatch(todo.slice(i, i + 20));
  process.stdout.write(`\r  ${Math.min(i + 20, todo.length)}/${todo.length}  ok ${ok} · 없음 ${missing} · 실패 ${failed}`);
  await sleep(600);
}
console.log(`\n완료 — ok ${ok} · 문서 없음/동음이의 ${missing} · 실패 ${failed} → ${CACHE}`);
