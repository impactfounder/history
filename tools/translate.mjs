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
 *         --redo <source_id,…> 캐시가 있어도 그 줄만 다시 옮긴다(새 줄이 뒤에 붙고 derive는 마지막 줄을 쓴다)
 *         --to en|ja|zh  반대 방향 — **한국어 원문 줄을 그 언어로**(2026-09-27, 대표 결정). 영·일·중 화면에 한국 열
 *                        사건이 한국어 원문으로 떠서(일·중 화면 각 약 2,900건, 97%가 한국 열) 그 화면 사용자는 한 글자도
 *                        읽을 수 없었다. 다른 언어끼리(일본어 화면의 영어 원문 등)는 옮기지 않는다 — 어느 정도 읽힌다.
 *                        캐시는 curation/translations/{en,ja,zh}.jsonl, 발행이 화면 언어별 파일로 따로 싣는다(publish.mjs).
 *
 * 링크: 그 줄에 걸린 위키백과 문서 제목(curation/raw의 links)을 함께 보낸다(2026-09-26). 연표의 짧은
 * 이름은 문장만으로는 뜻이 갈린다 — 「February — He died.」의 He는 **후한 화제**(링크 Emperor He of Han)인데
 * 문장만 받은 모델이 대명사로 읽어 「2월 — 사망하였다.」로 주어를 지웠다.
 * 키: .env의 ANTHROPIC_API_KEY (gitignore). 코드·로그에 절대 찍지 않는다.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { isEventName } from "../src/lib/event-name.mjs";

const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def);
const MODEL = arg("--model", "claude-sonnet-5");
const BATCH = Number(arg("--batch", 25));
const SAMPLE = process.argv.includes("--sample") ? Number(arg("--sample", 100)) : null;
const REGION = arg("--region", null);
const DRY = process.argv.includes("--dry");
const REDO = new Set(String(arg("--redo", "")).split(",").filter(Boolean));
const TO = arg("--to", "ko");
if (!["ko", "en", "ja", "zh"].includes(TO)) { console.error(`--to는 ko|en|ja|zh — 받은 값: ${TO}`); process.exit(1); }
const CACHE = `curation/translations/${TO}.jsonl`;

export const hashOf = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);

/** 글자 중 한글이 절반을 넘으면 이미 한국어로 본다(한자·가나·라틴은 분모에 넣고 숫자·기호는 뺀다). */
export const isMostlyHangul = (text) => {
  const letters = String(text).match(/[\uac00-\ud7a3a-zA-Z\u4e00-\u9fff\u3040-\u30ff]/g);
  if (!letters?.length) return false;
  const ko = String(text).match(/[\uac00-\ud7a3]/g)?.length ?? 0;
  return ko / letters.length > 0.5;
};

/** 한국어 원문 → 영·일·중. 표기 관례만 언어마다 다르고 나머지 규칙은 ko 방향과 같다. */
const TARGET_RULES = {
  en: "영어. 한국 인명·지명은 영어판 위키백과의 통용 표기(대개 개정 로마자 표기: Gwanggaeto the Great, Gyeongju), 왕조는 Goryeo · Joseon, 관직·제도는 뜻을 옮긴다",
  ja: "일본어. 한국 인명·지명은 일본어판 위키백과의 통용 표기(한자가 있으면 한자: 李舜臣, 慶州), 조선 왕조는 朝鮮王朝, 문체는 연표의 だ・である체 또는 체언 종결",
  zh: "중국어 간체. 한국 인명·지명은 중국어판 위키백과의 통용 표기(한자가 있으면 한자: 李舜臣, 庆州), 왕조는 高丽 · 朝鲜王朝, 문체는 연표의 간결한 서술",
};
const SYSTEM_TO = (to) => `너는 한국사 연표를 ${TARGET_RULES[to]}로 옮기는 번역기다. 입력은 한국어 연표의 한 줄(위키백과 또는 국사편찬위원회 연표)이다.
규칙:
1. 뜻을 더하거나 빼지 않는다. 요약·해설·보충 금지. 원문의 문장 수를 유지한다.
2. 고유명사는 용어집(glossary)을 그대로 따른다. 용어집에 없으면 위 표기 관례를 따른다.
3. 날짜·숫자·연호는 그대로 둔다. 원문 괄호 안의 한자는 그대로 두거나, 그 언어가 한자를 쓰면 본문 표기로 흡수한다. 원문에 없는 괄호 병기를 추가하지 않는다.
4. 원문이 문장이면 문장으로, 구면 구로.
5. 출력은 JSON 배열만. 다른 말은 쓰지 않는다: [{"id":"…","t":"…"}]
6. 항목의 links는 그 줄에 링크로 걸린 위키백과 문서 제목이다. 뜻을 가리는 데만 쓰고 원문에 없는 내용을 더하지 않는다.
7. 원문의 1인칭 나라 표현(「우리 나라」「아국」「본국」)은 그 시기 한국의 나라 이름(고려·조선 등, 모르면 Korea/朝鮮/朝鲜)으로 옮긴다 — 그대로 옮기면 읽는 사람의 나라가 된다(일본어 「我が国」= 일본).`;

const SYSTEM = `너는 역사 연표를 한국어로 옮기는 번역기다. 입력은 위키백과 연표의 한 줄(영어·일본어·중국어)이다.
규칙:
1. 뜻을 더하거나 빼지 않는다. 요약·해설·보충 금지. 원문의 문장 수와 구두점을 유지한다.
2. 고유명사는 용어집(glossary)을 그대로 따른다. 용어집에 없으면 한국 사학계 관용 표기를 쓴다 — 일본 인명·지명은 일본어 발음(도요토미 히데요시), 중국 전근대는 한자음(주원장), 중국 근현대 인명은 원음(마오쩌둥), 영어권은 통용 표기(에이브러햄 링컨).
3. 날짜·숫자·연호·괄호 안 원어 표기는 그대로 둔다. 원문에 없는 괄호 병기를 추가하지 않는다.
4. 연표 문체로 — 명사형 종결("…을 체결.", "…이 즉위.")을 원문이 문장이면 문장으로, 구면 구로.
5. 출력은 JSON 배열만. 다른 말은 쓰지 않는다: [{"id":"…","ko":"…"}]
6. 항목의 links는 그 줄의 원문에 링크로 걸린 위키백과 문서 제목이다. 원문의 낱말이 링크 대상의 이름이면 그 대상으로 옮긴다 — 「He died.」에 링크 "Emperor He of Han"이 있으면 He는 대명사가 아니라 후한 화제다. links는 뜻을 가리는 데만 쓰고 원문에 없는 내용을 더하지 않는다.`;

// ── 대상 모으기 ─────────────────────────────────────────────────────────────
mkdirSync("curation/translations", { recursive: true });
const cache = new Set(existsSync(CACHE) ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).h) : []);
const regions = REGION ? [REGION] : ["kr", "cn", "jp", "ai", "us"];
// ko 방향은 한국어 원문이 없는 파일만 보면 되지만, 반대 방향은 국사편찬위 줄(kr-nikh, 전부 한국어)이 대상의 중심이다
const stems = regions.flatMap((r) => (TO !== "ko" && r === "kr" ? ["kr", "kr-nikh"] : [r]));
let items = [];
for (const stem of stems) {
  const region = stem.split("-")[0];
  const f = `curation/events/${stem}.jsonl`;
  if (!existsSync(f)) continue;
  // 원천 링크(수집 원문, gitignore). 없으면 링크 없이 옮긴다 — 예전과 같다
  const rawF = `curation/raw/${region}/candidates.jsonl`;
  const links = new Map(existsSync(rawF) ? readFileSync(rawF, "utf8").split("\n").filter(Boolean).map((l) => { const d = JSON.parse(l); return [d.id, d.links ?? []]; }) : []);
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status !== "published") continue;
    /*
      lang이 en이어도 제목이 이미 한국어인 줄이 있다 — 위키데이터 즉위 줄의 ko 표제어가 title로 들어온 경우다
      (고국천왕·광개토대왕…). 그래서 lang이 아니라 **글자**로 판정한다: ko 방향은 한국어가 아닌 제목만,
      반대 방향은 한국어 제목만.
    */
    // 반대 방향: 한국어 원문 줄이면 한자가 섞여 한글이 절반이 안 돼도(「이완(李完, 李琓) 출생」) 대상이다
    if (TO === "ko" ? r.lang === "ko" || isMostlyHangul(r.title) : !(isMostlyHangul(r.title) || (r.lang === "ko" && /[가-힣]/.test(r.title)))) continue;
    /*
      반대 방향: 그 화면이 이미 **그 언어의 이름**을 보여 주는 줄은 옮기지 않는다 — 번역이 쓰일 자리가 없다.
      화면의 라벨 규칙(src/lib/i18n.ts eventLabelRaw)과 같은 판정: 위키데이터 사건 줄(source_id wd_)이거나
      그 언어 표제어가 사건 꼴(isEventName)이면 이름이 선다. 3,570 → 아래 대상 수.
    */
    if (TO !== "ko") {
      const nat = r.names_native?.[TO]?.replace(/\s*\([^)]*\)$/, "");
      if (nat && (String(r.source_id).startsWith("wd_") || isEventName(nat, TO))) continue;
    }
    const h = hashOf(r.lang, r.title);
    if (cache.has(h) && !REDO.has(r.source_id)) continue;
    // 용어집: 이 줄에 실제로 있는 원문 표제어만 — ko 방향은 원어 → ko, 반대 방향은 ko → 그 언어
    const glossary = [];
    const strip = (x) => x.replace(/\s*\([^)]*\)$/, "");
    const from = TO === "ko" ? r.names_native?.[r.lang] : r.names_native?.ko, into = r.names_native?.[TO];
    if (from && into && r.title.includes(strip(from))) glossary.push([strip(from), strip(into)]);
    items.push({ h, region, lang: r.lang, year: r.date.year, text: r.title, glossary, links: (links.get(r.source_id) ?? []).slice(0, 8) });
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
console.log(`${TO} 방향 · 대상 ${items.length}줄 (캐시 ${cache.size}) · 모델 ${MODEL} · 배치 ${BATCH}${DRY ? " · dry" : ""}`);
if (DRY || !items.length) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음 — .env에 넣고 node --env-file=.env 로 실행"); process.exit(1); }

// ── 호출 ────────────────────────────────────────────────────────────────────
const client = new Anthropic();
let usage = { input: 0, output: 0 }, done = 0, failed = 0;

/**
 * 출력 상한. 4096이었을 때 배치 25가 상한에 걸려 JSON이 중간에서 잘렸고, 그 배치 25건이
 * 통째로 버려졌다(표본 100건 중 25건 실패, 2026-09-12). 건당 출력이 약 170토큰이라
 * 25건이면 4,300 — 상한을 넘는다. claude-sonnet-5는 128K까지 받지만 비스트리밍에서는
 * 16000이 권장 기본값이다(HTTP 타임아웃 여유).
 */
const MAX_TOKENS = 16000;

/**
 * 한 배치를 번역한다. 잘리거나(stop_reason=max_tokens) 파싱이 깨지면 **같은 입력으로 다시
 * 부르지 않고 절반으로 쪼갠다** — 같은 호출을 반복하면 같은 자리에서 또 잘리고 토큰만 두 배로 쓴다.
 * 1건까지 쪼개도 안 되면 그 건만 실패로 센다.
 */
async function translateBatch(batch, depth = 0) {
  const glossary = Object.fromEntries(batch.flatMap((b) => b.glossary));
  const user = JSON.stringify({ glossary, items: batch.map((b, k) => ({ id: String(k), lang: b.lang, text: b.text, ...(b.links?.length ? { links: b.links } : {}) })) });
  const res = await client.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system: TO === "ko" ? SYSTEM : SYSTEM_TO(TO), messages: [{ role: "user", content: user }] });
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
    await translateBatch(batch.slice(0, half), depth + 1);
    await translateBatch(batch.slice(half), depth + 1);
    return;
  }

  const at = new Date().toISOString();
  batch.forEach((b, k) => {
    const hit = parsed.find((p) => String(p.id) === String(k));
    const out = TO === "ko" ? hit?.ko : hit?.t;
    if (!out) { failed++; return; }
    // ko 캐시는 예전 모양(ko 필드) 그대로 — derive.mjs가 그것을 읽는다. 반대 방향은 t 필드
    appendFileSync(CACHE, JSON.stringify({ h: b.h, lang: b.lang, src: b.text, ...(TO === "ko" ? { ko: String(out).trim() } : { to: TO, t: String(out).trim() }), model: MODEL, at }) + "\n");
    done++;
  });
}

for (let i = 0; i < items.length; i += BATCH) {
  await translateBatch(items.slice(i, i + BATCH));
  process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}  완료 ${done} 실패 ${failed}  토큰 in ${usage.input} out ${usage.output}`);
}
console.log(`\n완료 ${done} · 실패 ${failed} · 토큰 입력 ${usage.input} 출력 ${usage.output} → ${CACHE}`);
