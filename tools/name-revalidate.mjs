/**
 * **버려진 이름을 지금 규칙으로 다시 본다** — 모델을 부르지 않는다.
 *
 * `tools/name.mjs`는 모델이 낸 이름을 `validName`(tools/name-rules.mjs)으로 거르고, 버린 것도 캐시에
 * `{ name: null, why: "rejected", got: "<모델이 낸 이름>" }`으로 남긴다. 규칙을 고쳤을 때(2026-09-26 — 날짜
 * 규칙이 「10월 혁명」 「주5일 근무제 시행」까지 버리던 것) 그 이름을 되살리는 데 **다시 돈을 쓸 까닭이 없다**:
 * 모델이 낸 값은 이미 `got`에 있다.
 *
 * 캐시는 덧붙이기만 한다 — 원래의 버림 기록은 그대로 두고, 통과한 것만 `why: "revalidated"`로 새 줄을 쓴다.
 * 발행은 같은 키(h)의 **마지막 줄**을 쓴다(publish.mjs names_ko). 이미 이름이 있는 키는 건드리지 않는다.
 *
 * 사용: node tools/name-revalidate.mjs [--dry]
 */
import { appendFileSync, readFileSync } from "node:fs";
import { validName } from "./name-rules.mjs";

const CACHE = "curation/names/ko.jsonl";
const dry = process.argv.includes("--dry");

const last = new Map();
for (const l of readFileSync(CACHE, "utf8").split("\n").filter(Boolean)) {
  let d; try { d = JSON.parse(l); } catch { continue; }
  if (d?.h) last.set(d.h, d);
}

const revived = [];
for (const d of last.values()) {
  if (d.name || d.why !== "rejected" || typeof d.got !== "string") continue;
  /*
    **한 줄에 사건이 여럿인 원문은 되살리지 않는다.** 「二月抗争。6月17日首枚氢弹爆炸。台北市升格為直轄市。…」에
    「2월 항쟁」을 붙이면 칩에서 중국 첫 수소폭탄 폭발이 사라진다. 원문 **중간에** 문장 끝(。)이 있으면 묶음으로
    보고 둔다 — 이런 줄은 이름이 아니라 쪼개기가 필요하다(PRD A-15에서 미룬 것).
  */
  if (/。./.test(String(d.src).trim())) continue;
  // 연도를 모르므로 넘기지 않는다 — 「1940년 미국 대선」처럼 연도가 붙은 이름은 그대로 버려진다(보수적)
  const name = validName(d.got, d.src);
  if (name) revived.push({ h: d.h, lang: d.lang, src: d.src, name, why: "revalidated", got: d.got, model: "rule", at: new Date().toISOString() });
}

for (const r of revived) console.log(`  「${r.name}」 ← ${String(r.src).slice(0, 50)}`);
if (!dry && revived.length) appendFileSync(CACHE, revived.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\n되살림 ${revived.length}건${dry ? " (dry — 쓰지 않음)" : ` → ${CACHE}`}`);
