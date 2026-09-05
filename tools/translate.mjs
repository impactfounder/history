/**
 * 한글 옮김 — editorial-policy §3-1 P1, 대표 결정 2026-09-05 ("번역 한 곳에만 LLM").
 *
 * 원문(title: 연도 표기를 뗀 연표 한 줄)을 한국어로 옮겨 curation/translations/ko.jsonl 에 쌓는다.
 * 키는 sha1(lang|원문)이라 같은 줄은 다시 번역하지 않고, 재수집으로 바뀐 줄만 새로 돈다.
 * derive.mjs가 이 캐시를 읽어 title_ko를 붙이고, UI는 "기계 번역"이라 표시한다. 원문이 진본이다.
 *
 * 용어집: 그 줄의 QID 사이트링크(names_native)에서 원문 표제어 → ko 표제어 쌍을 뽑아 배치마다
 * 넣는다. 관점 명칭이 곧 용어집이다 — 인명·사건명이 흔들리지 않게 하는 장치.
 *
 * 사용:
 *   node --env-file=.env tools/translate.mjs --sample 100          표본(시대별 층화)만
 *   node --env-file=.env tools/translate.mjs --region jp             한 열 전부
 *   node --env-file=.env tools/translate.mjs                         캐시에 없는 줄 전부
 *   옵션: --model claude-sonnet-5 (기본) · --batch 25 · --dry (호출 없이 대상만 센다)
 * 키: .env의 ANTHROPIC_API_KEY (gitignore). 코드·로그에 절대 찍지 않는다.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def);
const MODEL = arg("--model", "claude-sonnet-5");
const BATCH = Number(arg("--batch", 25));
const SAMPLE = process.argv.includes("--sample") ? Number(arg("--sample", 100)) : null;
const REGION = arg("--region", null);
const DRY = process.argv.includes("--dry");
const CACHE = "curation/translations/ko.jsonl";

export const hashOf = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);

const SYSTEM = `너는 역사 연표를 한국어로 옮기는 번역기다. 입력은 위키백과 연표의 한 줄(영어·일본어·중국어)이다.
규칙:
1. 뜻을 더하거나 빼지 않는다. 요약·해설·보충 금지. 원문의 문장 수와 구두점을 유지한다.
2. 고유명사는 용어집(glossary)을 그대로 따른다. 용어집에 없으면 한국 사학계 관용 표기를 쓴다 — 일본 인명·지명은 일본어 발음(도요토미 히데요시), 중국 전근대는 한자음(주원장), 중국 근현대 인명은 원음(마오쩌둥), 영어권은 통용 표기(에이브러햄 링컨).
3. 날짜·숫자·연호·괄호 안 원어 표기는 그대로 둔다. 원문에 없는 괄호 병기를 추가하지 않는다.
4. 연표 문체로 — 명사형 종결("…을 체결.", "…이 즉위.")을 원문이 문장이면 문장으로, 구면 구로.
5. 출력은 JSON 배열만. 다른 말은 쓰지 않는다: [{"id":"…","ko":"…"}]`;

// ── 대상 모으기 ─────────────────────────────────────────────────────────────
mkdirSync("curation/translations", { recursive: true });
const cache = new Set(existsSync(CACHE) ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).h) : []);
const regions = REGION ? [REGION] : ["kr", "cn", "jp", "us"];
let items = [];
for (const region of regions) {
  const f = `curation/events/${region}.jsonl`;
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status !== "published" || r.lang === "ko") continue;
    const h = hashOf(r.lang, r.title);
    if (cache.has(h)) continue;
    // 용어집: 이 줄에 실제로 있는 원문 표제어만
    const glossary = [];
    const src = r.names_native?.[r.lang], ko = r.names_native?.ko;
    if (src && ko && r.title.includes(src)) glossary.push([src, ko.replace(/\s*\([^)]*\)$/, "")]);
    items.push({ h, region, lang: r.lang, year: r.date.year, text: r.title, glossary });
  }
}
if (SAMPLE) {
  // 시대별 층화 — 고대·중세·근대·현대가 골고루 들어가야 표기 흔들림이 보인다
  const era = (y) => (y < 1000 ? 0 : y < 1800 ? 1 : y < 1945 ? 2 : 3);
  const groups = [[], [], [], []];
  for (const it of items) groups[era(it.year)].push(it);
  let seed = 7;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  items = groups.flatMap((g) => g.sort(() => rnd() - 0.5).slice(0, Math.ceil(SAMPLE / 4))).slice(0, SAMPLE);
}
console.log(`대상 ${items.length}줄 (캐시 ${cache.size}) · 모델 ${MODEL} · 배치 ${BATCH}${DRY ? " · dry" : ""}`);
if (DRY || !items.length) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음 — .env에 넣고 node --env-file=.env 로 실행"); process.exit(1); }

// ── 호출 ────────────────────────────────────────────────────────────────────
const client = new Anthropic();
let usage = { input: 0, output: 0 }, done = 0, failed = 0;
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const glossary = Object.fromEntries(batch.flatMap((b) => b.glossary));
  const user = JSON.stringify({ glossary, items: batch.map((b, k) => ({ id: String(k), lang: b.lang, text: b.text })) });
  let parsed = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 4096, system: SYSTEM, messages: [{ role: "user", content: user }] });
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    try {
      const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
      if (Array.isArray(arr)) parsed = arr;
    } catch { /* 한 번 더 */ }
  }
  if (!parsed) { failed += batch.length; console.warn(`  배치 ${i / BATCH + 1}: JSON 파싱 실패`); continue; }
  const at = new Date().toISOString();
  for (const b of batch) {
    const hit = parsed.find((p) => String(p.id) === String(batch.indexOf(b)));
    if (!hit?.ko) { failed++; continue; }
    appendFileSync(CACHE, JSON.stringify({ h: b.h, lang: b.lang, src: b.text, ko: String(hit.ko).trim(), model: MODEL, at }) + "\n");
    done++;
  }
  process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}  토큰 in ${usage.input} out ${usage.output}`);
}
console.log(`\n완료 ${done} · 실패 ${failed} · 토큰 입력 ${usage.input} 출력 ${usage.output} → ${CACHE}`);
