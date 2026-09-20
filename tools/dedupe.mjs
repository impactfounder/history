/**
 * 같은 칸에 같은 제목이 둘 이상 — 합칠 것인가, 다시 이름 붙일 것인가.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * `tools/name.mjs`로 제목을 짓고 나니 (열, 연도, 제목)이 겹치는 묶음이 255개 527건 나왔다
 * (실측 2026-09-12, 이름 지은 7,953건의 6.6%). `eventLabel`의 중복 규칙이 그때 전부 원문
 * 문장으로 되돌리므로, 하필 **가장 유명한 사건들**(3·1 운동, 노량해전, 정묘호란, 대한민국
 * 정부 수립)이 긴 문장으로 남는다. 여러 나라 연표에 다 실릴 만큼 큰 사건이라 겹친 것이다.
 *
 * ── 왜 규칙으로 안 되는가 ───────────────────────────────────────────────────
 * 겹침에는 **두 종류**가 있고 표면형이 같다.
 *   1) 진짜 중복 — 같은 사건을 위키 en·zh·ko 줄이 각각 쓴 것. 합쳐야 한다.
 *   2) 캠페인 국면 — 「녕왕의 난: 안칭 포위」「녕왕의 난: 난창 탈환」처럼 한 해 안의 서로
 *      다른 전투. 합치면 내용이 지워진다. 제목이 상위 캠페인 이름이라 겹쳤을 뿐이다.
 * 둘 다 `X: Y` 꼴이고, 월도 겹치고(녕왕의 난은 6건 중 4건이 8월), 글줄 유사도도 비슷하다
 * (「방랍이 양절로에서 반란」 대 「방랍이 흡현에서 봉기」는 서로 다른 언어의 같은 사건인데
 *  「안칭시를 포위」 대 「주장시를 점령」과 유사도가 다르지 않다). derive.mjs의
 * `mergeDuplicates`가 같은 언어판 두 줄을 건드리지 않는 이유도 같다 —
 * ja 「ポツダム宣言発表」와 「ポツダム宣言受諾」이 같은 QID를 갖는다는 것을 이미 겪었다.
 *
 * 그래서 7,900건은 규칙으로 끝내고 **애매한 255묶음만** 판단을 구한다. 답이 이상하면
 * 그 묶음은 손대지 않는다 — 오늘의 동작(문장으로 되돌림)이 안전한 기본값이라 그래도 된다.
 *
 * 사용:
 *   node --env-file=.env tools/dedupe.mjs --dry      묶음만 세고 끝낸다
 *   node --env-file=.env tools/dedupe.mjs --sample 20
 *   node --env-file=.env tools/dedupe.mjs
 * 키: .env의 ANTHROPIC_API_KEY (gitignore). 코드·로그에 절대 찍지 않는다.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

import { isEventName } from "../src/lib/event-name.mjs";
import { validName } from "./name-rules.mjs";

const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def);
const MODEL = arg("--model", "claude-sonnet-5");
const SAMPLE = process.argv.includes("--sample") ? Number(arg("--sample", 20)) : null;
const DRY = process.argv.includes("--dry");
const CACHE = "curation/names/clash.jsonl";
const NAMES = "curation/names/ko.jsonl";

const hashOf = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);

const SYSTEM = `너는 역사 연표를 정리하는 편집자다. 같은 나라·같은 해에 **같은 제목**이 붙은 줄들을 준다.
둘 중 하나로 판정하라.

A) 같은 사건이다 — 여러 언어판·여러 원천이 같은 일을 각각 서술한 것.
   {"same": true, "primary": <가장 정확하고 구체적인 줄의 id>}
   primary는 날짜가 분명하고 서술이 구체적인 줄을 고른다. 나머지는 그 줄에 합쳐지고
   원문은 상세 화면에 관점별로 남는다.

B) 다른 사건이다 — 한 해 안에서 벌어진 서로 다른 일인데 상위 사건 이름이 제목으로 붙었다.
   「녕왕의 난: 안칭 포위」와 「녕왕의 난: 난창 탈환」은 다른 전투다.
   {"same": false, "names": {"<id>": "<그 줄만의 제목>", ...}}
   각 줄에 **그 줄에서 실제로 일어난 일**의 제목을 12자 이내 한국어 명사구로 새로 붙인다.
   상위 사건 이름을 그대로 쓰지 않는다 — 그래서 겹쳤다. 날짜·연도는 넣지 않는다.
   서술어로 끝내지 않는다("…했다" 금지).

판단이 서지 않으면 {"same": null}을 낸다. 억지로 정하지 않는 것이 낫다.
출력은 JSON 객체 하나만. 다른 말은 쓰지 않는다.`;

// ── 묶음 만들기 ─────────────────────────────────────────────────────────────
mkdirSync("curation/names", { recursive: true });
const names = new Map(
  existsSync(NAMES)
    ? readFileSync(NAMES, "utf8").split("\n").filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((n) => n?.name).map((n) => [n.h, n.name])
    : [],
);
const done = new Set(
  existsSync(CACHE)
    ? readFileSync(CACHE, "utf8").split("\n").filter(Boolean)
        .map((l) => { try { return JSON.parse(l).g; } catch { return null; } }).filter(Boolean)
    : [],
);

const FILES = ["kr", "kr-nikh", "cn", "jp", "ai", "us"];
const groups = new Map();
for (const stem of FILES) {
  const f = `curation/events/${stem}.jsonl`;
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status !== "published" || r.kind === "period") continue;
    /*
      publish/eventLabel이 보는 것과 **같은 제목**을 만든다. 처음에는 위키 표제어로 이름이
      나온 행을 빼고 지은 제목만 묶었는데, 그러면 임진왜란·한일병합조약·4·19 혁명처럼
      한쪽은 표제어에서, 다른 쪽은 지은 제목에서 같은 이름이 나온 겹침 91묶음 196건을
      통째로 놓친다 — 하필 가장 유명한 것들이다.
    */
    const wiki = r.names_native?.ko?.replace(/\s*\([^)]*\)$/, "");
    const fromWiki = Boolean(wiki && isEventName(wiki, "ko"));
    const label = fromWiki ? wiki : names.get(hashOf(r.lang, r.title));
    if (!label) continue;
    r._fromWiki = fromWiki;
    const k = `${r.region}|${r.date.year}|${label}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
}
let clashes = [...groups].filter(([k, v]) => v.length > 1 && !done.has(k));
if (SAMPLE) clashes = clashes.slice(0, SAMPLE);
const items = clashes.reduce((a, [, v]) => a + v.length, 0);
console.log(`겹치는 묶음 ${clashes.length}개 · ${items}건 (처리됨 ${done.size}) · 모델 ${MODEL}${DRY ? " · dry" : ""}`);
if (DRY || !clashes.length) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음 — .env에 넣고 node --env-file=.env 로 실행"); process.exit(1); }

// ── 묻기 ────────────────────────────────────────────────────────────────────
const client = new Anthropic();
let usage = { input: 0, output: 0 }, mergedG = 0, mergedRows = 0, renamedG = 0, renamedRows = 0, held = 0;

for (const [k, v] of clashes) {
  const [, year, label] = k.split("|");
  const user = JSON.stringify({
    year: Number(year),
    title: label,
    lines: v.map((r) => ({ id: r.source_id, lang: r.lang, text: r.lang === "ko" ? r.title : (r.title_ko ?? r.title) })),
  });
  const res = await client.messages.create({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] });
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;

  let out = null, raw = "";
  raw = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  if (res.stop_reason !== "max_tokens") {
    try { out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch { /* 아래에서 보류 */ }
  }
  // 왜 못 읽었는지 남긴다. 가장 큰 묶음 둘이 조용히 보류로 빠져 있었다(2026-09-13)
  if (!out) console.warn(`
  읽지 못함(${res.stop_reason}) ${k}: ${raw.slice(0, 160).replace(/\s+/g, " ")}`);

  const at = new Date().toISOString();
  const ids = new Set(v.map((r) => r.source_id));
  const hold = (why) => { held++; appendFileSync(CACHE, JSON.stringify({ g: k, same: null, why, model: MODEL, at }) + "\n"); };

  if (!out || out.same === null || out.same === undefined) { hold(out ? "model-null" : "parse"); }
  else if (out.same === true) {
    // 대표가 이 묶음 안에 있어야 한다. 없으면 손대지 않는다
    if (!ids.has(out.primary)) hold("primary-unknown");
    else {
      const drop = v.map((r) => r.source_id).filter((id) => id !== out.primary);
      appendFileSync(CACHE, JSON.stringify({ g: k, same: true, primary: out.primary, drop, model: MODEL, at }) + "\n");
      mergedG++; mergedRows += drop.length;
    }
  } else {
    /*
      표제어로 이름이 나온 행에도 새 제목을 준다. 우선순위 규칙을 깨지 않는다 —
      eventLabel은 표제어가 **겹치지 않을 때만** 그것을 쓰고, 겹치면 이미 문장으로 밀어낸다.
      새 제목은 그 밀려난 자리에 설 뿐이다.

      그리고 한 칸에서 같은 표제어가 여섯 번 겹친다면(의화단 운동·녕왕의 난·팔왕의 난)
      그 표제어는 **그 줄의 사건 이름이 아니라 링크된 상위 항목**이다 — "네덜란드"가
      하멜 탈출의 이름이 아닌 것과 같다. isEventName이 「…운동」·「…의 난」을 통과시켜
      걸러지지 않았을 뿐이다. 그 자리에는 구체적인 제목이 서는 것이 맞다.
    */
    // 모든 줄에 새 제목이 있고, 전부 검증을 통과하고, 서로 겹치지 않아야 한다
    const got = out.names ?? {};
    const rename = {};
    let ok = true;
    for (const r of v) {
      const n = validName(got[r.source_id], r.title, r.date.year);
      if (!n) { ok = false; break; }
      rename[r.source_id] = n;
    }
    const uniq = new Set(Object.values(rename));
    if (!ok || uniq.size !== v.length) hold(ok ? "rename-collide" : "rename-invalid");
    else {
      appendFileSync(CACHE, JSON.stringify({ g: k, same: false, rename, model: MODEL, at }) + "\n");
      renamedG++; renamedRows += v.length;
    }
  }
  process.stdout.write(`\r  합침 ${mergedG}묶음/${mergedRows}행 · 새 제목 ${renamedG}묶음/${renamedRows}행 · 보류 ${held}  토큰 in ${usage.input} out ${usage.output}`);
}
console.log(`\n완료 · 합침 ${mergedG}묶음(${mergedRows}행 사라짐) · 새 제목 ${renamedG}묶음(${renamedRows}행) · 보류 ${held} → ${CACHE}`);
