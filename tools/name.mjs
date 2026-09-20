/**
 * 사건 제목 짓기 — 대표 결정 2026-09-12.
 *
 * 왜 필요한가: 원천(각 언어 연표 문서·국사편찬위)은 **이름 붙은 사건 목록이 아니라 문장으로 쓴
 * 연대기**다. 그래서 칩에 "2월. 14개조 평화 원칙에서 제시된 민족자결주의에 영향을 받아…"가 통째로
 * 들어간다. 실측(2026-09-12): 발행 11,586건 중 짧은 사건명으로 나오는 것은 1,044건(9%)뿐이고
 * 라벨 길이 중앙값이 25자, 56.6%가 21자를 넘는다.
 *
 * 문장에서 기계로 뽑아낼 수 없다는 것도 재서 확인했다. `날짜 – 사건명; 부연` 꼴은 10,542건 중
 * **29건**만 맞고, 사건 꼴 명사구 추출은 284건에 정확도가 낮다(2·8선언 문장에서 "독립운동",
 * 적십자 가입 문장에서 "위원회의"를 집는다). 이름은 뽑는 게 아니라 **써야** 한다.
 *
 * 원문은 그대로 남는다. 이 파일이 만드는 것은 칩과 상세 제목에 쓸 **파생 이름**이고,
 * 상세의 본문·원문·출처는 하나도 바뀌지 않는다. translate.mjs와 같은 지위다 —
 * 진본은 원문이고 이것은 파생물이다.
 *
 * 이름을 이미 가진 줄(names_native.ko가 사건 꼴)과 이미 짧은 줄(≤14자)은 **보내지 않는다.**
 * 전자는 원문 표제어가 더 정확하고, 후자는 이미 제목처럼 읽힌다 — 둘 다 돈만 든다.
 *
 * 사용:
 *   node --env-file=.env tools/name.mjs --sample 100     표본(시대별 층화)만 — 프롬프트 점검용
 *   node --env-file=.env tools/name.mjs --region kr       한 열 전부
 *   node --env-file=.env tools/name.mjs                   캐시에 없는 줄 전부
 *   옵션: --model claude-sonnet-5 (기본) · --batch 40 · --dry (호출 없이 대상만 센다)
 * 키: .env의 ANTHROPIC_API_KEY (gitignore). 코드·로그에 절대 찍지 않는다.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

import { isEventName } from "../src/lib/event-name.mjs";
import { ALREADY_SHORT, validName } from "./name-rules.mjs";

const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def);
const MODEL = arg("--model", "claude-sonnet-5");
const BATCH = Number(arg("--batch", 40));
const SAMPLE = process.argv.includes("--sample") ? Number(arg("--sample", 100)) : null;
const REGION = arg("--region", null);
const DRY = process.argv.includes("--dry");
const CACHE = "curation/names/ko.jsonl";

/** translate.mjs와 같은 키 공간 — 원문 한 줄이 키다. 재수집으로 바뀐 줄만 다시 돈다. */
export const hashOf = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);

const SYSTEM = `너는 역사 연표의 한 줄에 **제목**을 붙이는 편집자다. 입력은 사건을 서술한 문장이다.
규칙:
1. 한국어 명사구로 12자 이내. 서술어로 끝내지 않는다("…했다", "…하다", "…되었다" 금지).
2. 그 사건에 **관용 명칭이 있으면 그것을 그대로** 쓴다 — 임진왜란, 3·1 운동, 강화도 조약, 진주만 공격.
   관용 명칭이 없으면 무엇이 일어났는지 알 수 있는 최소한의 명사구를 짓는다:
   "조선이 그레고리력을 사용하기 시작했다" → "그레고리력 도입"
   "하멜과 선원들이 조선을 탈출하여 일본으로 갔다" → "하멜 일행 탈출"
3. 날짜·연도를 넣지 않는다(시간축에 이미 있다). 문장에 없는 사실, 해석, 평가를 넣지 않는다.
4. 한 줄에 사건이 여럿이면 **첫 번째이자 가장 큰** 것만 제목으로 삼는다.
5. 제목을 붙일 수 없으면 name을 null로 둔다. 주어가 불분명하거나 서술이 너무 막연한 줄이 그렇다.
   **억지로 짓지 않는 것이 낫다** — 틀린 제목은 원문 문장을 그대로 두는 것보다 나쁘다.
6. 출력은 JSON 배열만. 다른 말은 쓰지 않는다: [{"id":"…","name":"…"}] 또는 {"id":"…","name":null}`;

// ── 대상 모으기 ─────────────────────────────────────────────────────────────
mkdirSync("curation/names", { recursive: true });
const cache = new Set(existsSync(CACHE) ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).h) : []);
/**
 * 국사편찬위 줄(kr-nikh)은 kr.jsonl과 **나란히 있는 별도 파일**이고 publish가 둘 다 읽는다.
 * 빠뜨리면 2,143건이 통째로 새는데, 하필 그것이 가장 심한 경우다 — 90%가 14자를 넘고
 * 이 프로젝트에서 가장 질 좋은 본문이다.
 */
const FILES = { kr: ["kr", "kr-nikh"], cn: ["cn"], jp: ["jp"], ai: ["ai"], us: ["us"] };
const regions = REGION ? [REGION] : ["kr", "cn", "jp", "ai", "us"];
let items = [];
const skipped = { 이름있음: 0, 이미짧음: 0, 캐시: 0 };
for (const stem of regions.flatMap((r) => FILES[r] ?? [r])) {
  const region = stem.split("-")[0];
  const f = `curation/events/${stem}.jsonl`;
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status !== "published") continue;
    // 원문 표제어가 이미 사건 꼴이면 그것이 더 정확하다(i18n.ts eventLabel이 그것을 먼저 쓴다)
    const wiki = r.names_native?.ko?.replace(/\s*\([^)]*\)$/, "");
    if (wiki && isEventName(wiki, "ko")) { skipped.이름있음++; continue; }
    // ko UI가 실제로 보여 주는 글줄
    const shown = (r.lang === "ko" ? r.title : r.title_ko ?? r.title) ?? "";
    if (!shown.trim()) continue;
    if (shown.trim().length <= ALREADY_SHORT) { skipped.이미짧음++; continue; }
    const h = hashOf(r.lang, r.title);
    if (cache.has(h)) { skipped.캐시++; continue; }
    items.push({ h, region, lang: r.lang, year: r.date.year, text: r.title, ko: r.lang === "ko" ? null : r.title_ko ?? null });
  }
}
// 같은 원문이 여러 열에 있으면 한 번만 보낸다
const uniq = new Map();
for (const it of items) if (!uniq.has(it.h)) uniq.set(it.h, it);
items = [...uniq.values()];

if (SAMPLE) {
  // 시대별 층화 — 고대·중세·근대·현대가 골고루 들어가야 이름 짓는 버릇이 보인다
  const era = (y) => (y < 1000 ? 0 : y < 1800 ? 1 : y < 1945 ? 2 : 3);
  const groups = [[], [], [], []];
  for (const it of items) groups[era(it.year)].push(it);
  let seed = 7;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  items = groups.flatMap((g) => g.sort(() => rnd() - 0.5).slice(0, Math.ceil(SAMPLE / 4))).slice(0, SAMPLE);
}
console.log(`대상 ${items.length}줄 · 건너뜀(이름있음 ${skipped.이름있음} · 이미짧음 ${skipped.이미짧음} · 캐시 ${skipped.캐시}) · 모델 ${MODEL} · 배치 ${BATCH}${DRY ? " · dry" : ""}`);
if (DRY || !items.length) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음 — .env에 넣고 node --env-file=.env 로 실행"); process.exit(1); }

// ── 호출 ────────────────────────────────────────────────────────────────────
const client = new Anthropic();
let usage = { input: 0, output: 0 }, done = 0, nulled = 0, rejected = 0, failed = 0;

/** translate.mjs와 같은 이유로 넉넉히. 건당 출력이 짧아 배치를 더 크게 잡는다. */
const MAX_TOKENS = 16000;

/**
 * 한 배치에 이름을 짓는다. 잘리거나 파싱이 깨지면 **같은 입력으로 다시 부르지 않고 절반으로
 * 쪼갠다** — 같은 호출을 반복하면 같은 자리에서 또 잘리고 토큰만 두 배로 쓴다(2026-09-12 교훈).
 */
async function nameBatch(batch, depth = 0) {
  const user = JSON.stringify({
    items: batch.map((b, k) => ({ id: String(k), year: b.year, lang: b.lang, text: b.text, ...(b.ko ? { ko: b.ko } : {}) })),
  });
  const res = await client.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, messages: [{ role: "user", content: user }] });
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;

  let parsed = null;
  if (res.stop_reason !== "max_tokens") {
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    try {
      const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
      if (Array.isArray(arr)) parsed = arr;
    } catch { /* 아래에서 쪼갠다 */ }
  }

  if (!parsed) {
    if (batch.length === 1) {
      failed += 1;
      console.warn(`\n  건너뜀(${res.stop_reason}): ${batch[0].text.slice(0, 50)}`);
      return;
    }
    const half = Math.ceil(batch.length / 2);
    if (depth === 0) console.warn(`\n  ${res.stop_reason === "max_tokens" ? "출력 잘림" : "JSON 파싱 실패"} — ${batch.length}건을 ${half}건씩 쪼개 다시`);
    await nameBatch(batch.slice(0, half), depth + 1);
    await nameBatch(batch.slice(half), depth + 1);
    return;
  }

  const at = new Date().toISOString();
  batch.forEach((b, k) => {
    const hit = parsed.find((p) => String(p.id) === String(k));
    if (!hit) { failed++; return; }
    const raw = hit.name;
    if (raw === null || raw === undefined || raw === "") {
      // 모델이 "이름 없음"이라 답한 것도 결론이다 — 캐시에 남겨 다시 묻지 않는다
      appendFileSync(CACHE, JSON.stringify({ h: b.h, lang: b.lang, src: b.text, name: null, why: "model-null", model: MODEL, at }) + "\n");
      nulled++;
      return;
    }
    const ok = validName(raw, b.ko ?? b.text, b.year);
    if (!ok) {
      appendFileSync(CACHE, JSON.stringify({ h: b.h, lang: b.lang, src: b.text, name: null, why: "rejected", got: String(raw).slice(0, 40), model: MODEL, at }) + "\n");
      rejected++;
      return;
    }
    appendFileSync(CACHE, JSON.stringify({ h: b.h, lang: b.lang, src: b.text, name: ok, model: MODEL, at }) + "\n");
    done++;
  });
}

for (let i = 0; i < items.length; i += BATCH) {
  await nameBatch(items.slice(i, i + BATCH));
  process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}  지음 ${done} · 이름없음 ${nulled} · 버림 ${rejected} · 실패 ${failed}  토큰 in ${usage.input} out ${usage.output}`);
}
console.log(`\n완료 ${done} · 이름없음 ${nulled} · 버림 ${rejected} · 실패 ${failed} · 토큰 입력 ${usage.input} 출력 ${usage.output} → ${CACHE}`);
