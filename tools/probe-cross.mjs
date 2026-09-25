/**
 * **교차 사건 후보 — 사람이 판정할 목록**(2026-09-25, 진단 보고서 후속).
 *
 * 임진왜란이 세 열에 한 사건으로 서지 못한 원인은 둘이었다(status.md 「진단 후속 1·2」):
 * 합칠 때 QID를 버린 것(발행이 이제 물려받는다)과, 줄의 QID가 사건이 아니라 인물·나라인 것
 * (`curation/qid-fix.json`으로 고친다). 둘째는 **역사 판단**이라 기계가 정하지 않는다. 이 스크립트는
 * 판정할 거리만 뽑는다 — 대표가 ○/×/△를 적고, ○인 것을 qid-fix.json에 옮긴다.
 *
 *   ① 합칠 때 두 줄의 QID가 서로 달랐던 것 — 발행은 대표 줄의 QID를 그대로 둔다. 어느 쪽이 그 사건인가?
 *   ② 같은 해(±1) 여러 열의 줄이 **사건이 아닌 같은 QID**(인물·나라)에 붙은 것 — 같은 사건을 적었는가?
 *
 * 발행(tools/publish.mjs)이 원본을 읽고 합치는 방식을 그대로 따른다 — 목록이 실제 발행 결과와 같아야
 * 판정이 쓸모 있다. 발행은 건드리지 않는다.
 *
 * 출력: curation/_probe/cross-candidates.md
 * 사용: node tools/probe-cross.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eventId } from "./event-id.mjs";
import { EVENT_TYPES, NON_EVENT_TYPES, isEventLike } from "./event-kind.mjs";

const REGION_KO = { ai: "AI", kr: "한국", cn: "중국", jp: "일본", us: "미국" };

// ── 읽기 — publish.mjs와 같다 ──────────────────────────────────────────────
const all = [];
for (const f of readdirSync("curation/events").filter((x) => x.endsWith(".jsonl"))) {
  for (const l of readFileSync(path.join("curation/events", f), "utf8").trim().split("\n").filter(Boolean)) {
    const r = JSON.parse(l);
    if (r.status === "published" && r.kind !== "period") all.push(r);
  }
}
const qidFile = "curation/raw/_qid-sitelinks.json";
if (!existsSync(qidFile)) {
  console.error(`${qidFile}이 없다 — tools/enrich.mjs를 먼저 돌린다(QID의 이름·유형이 거기 있다).`);
  process.exit(1);
}
const { facts, titles } = JSON.parse(readFileSync(qidFile, "utf8"));

const names = new Map();
if (existsSync("curation/names/ko.jsonl")) {
  for (const l of readFileSync("curation/names/ko.jsonl", "utf8").split("\n").filter(Boolean)) {
    try { const n = JSON.parse(l); if (n.name) names.set(n.h, n.name); } catch {}
  }
}
const clash = { drop: new Map(), rename: new Map() };
for (const l of readFileSync("curation/names/clash.jsonl", "utf8").split("\n").filter(Boolean)) {
  let d; try { d = JSON.parse(l); } catch { continue; }
  if (d.same === true) for (const id of d.drop ?? []) clash.drop.set(id, d.primary);
  else if (d.same === false) for (const [id, n] of Object.entries(d.rename ?? {})) clash.rename.set(id, n);
}
const nameHash = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);
const labelOf = (r) => clash.rename.get(r.source_id) ?? names.get(nameHash(r.lang, r.title)) ?? r.title_ko ?? r.title;

/** QID 한 줄 요약 — 「임진왜란(Q576338) · 사건」. 표에 들어가므로 파이프는 뺀다. */
const kindOf = (qid) => {
  const f = facts[qid];
  if (!f) return "유형 모름";
  if (f.human) return "인물";
  if ((f.types ?? []).some((t) => EVENT_TYPES.has(t))) return "사건";
  if ((f.types ?? []).some((t) => NON_EVENT_TYPES.has(t))) return "장소·나라";
  return "기타";
};
const qidText = (qid) => (qid ? `${titles[qid]?.ko ?? titles[qid]?.en ?? "?"}(${qid}) · ${kindOf(qid)}` : "없음");
const cell = (s) => String(s ?? "").replace(/\|/g, "／").replace(/\s+/g, " ").slice(0, 70);

// ── ① 합칠 때의 QID 충돌 — publish.mjs 합치기와 같은 순서 ─────────────────────
const byId = new Map(all.map((r) => [r.source_id, r]));
const conflicts = [];
for (const r of all) {
  const into = clash.drop.get(r.source_id);
  const primary = into ? byId.get(into) : null;
  if (!primary || primary === r) continue;
  if (!primary.qid && r.qid) primary.qid = r.qid; // 발행의 QID 승계와 같다
  // 한 대표 줄에 같은 QID의 줄이 둘 합쳐지기도 한다(황건적의 난) — 한 번만 올린다
  else if (primary.qid && r.qid && primary.qid !== r.qid && !conflicts.some((c) => c.primary === primary && c.dropped.qid === r.qid)) conflicts.push({ primary, dropped: r });
  r.merged_into = into;
}
const kept = all.filter((r) => !r.merged_into);

/*
  기계 제안 — 판정은 사람이 한다. 근거는 둘이다.
    1) **QID 이름이 줄 이름과 같은 쪽.** 「황건적의 난」 줄의 사라진 쪽 QID 이름이 「황건적의 난」이다 —
       유형 정보가 비어 있어도(「기타」) 그쪽이 그 사건일 가능성이 높다.
    2) 한쪽만 사건 유형이면 그쪽.
*/
const norm = (s) => String(s ?? "").replace(/\s*\(.*?\)\s*/g, "").replace(/[\s.·]/g, "");
const sameName = (qid, label) => {
  const t = titles[qid];
  return Boolean(t) && [t.ko, t.en, t.ja, t.zh].some((x) => x && norm(x) === norm(label));
};
const suggestFor = ({ primary, dropped }) => {
  const label = labelOf(primary);
  const pa = sameName(primary.qid, label), pb = sameName(dropped.qid, label);
  if (pa && !pb) return "대표 쪽(이름 일치)";
  if (pb && !pa) return "사라진 쪽(이름 일치)";
  return suggest(primary.qid, dropped.qid);
};
const suggest = (a, b) => {
  const ka = kindOf(a), kb = kindOf(b);
  if (ka === "사건" && kb !== "사건") return "대표 쪽";
  if (kb === "사건" && ka !== "사건") return "사라진 쪽";
  return "—";
};

// ── ② 여러 열이 같은 비사건 QID에 붙은 줄 ─────────────────────────────────
// 교정표가 이미 고친 줄은 고친 QID로 본다 — 목록에 다시 올리지 않는다
const fixes = existsSync("curation/qid-fix.json") ? JSON.parse(readFileSync("curation/qid-fix.json", "utf8")).fixes : [];
const fixed = new Map(fixes.map((f) => [f.id, f]));
for (const r of kept) {
  const f = fixed.get(eventId(r));
  if (f && r.qid === f.from) r.qid = f.qid;
}
const byQid = new Map();
for (const r of kept) if (r.qid) (byQid.get(r.qid) ?? byQid.set(r.qid, []).get(r.qid)).push(r);
const shared = [];
for (const [qid, rs] of byQid) {
  if (isEventLike(rs[0], facts)) continue; // 사건이면 발행이 이미 묶는다
  // 해가 ±1 안인 무리로 나눈다 — 같은 인물이 몇 세기에 걸쳐 나오는 것은 한 사건이 아니다
  const sorted = [...rs].sort((a, b) => a.date.year - b.date.year);
  let group = [];
  const flush = () => {
    if (new Set(group.map((r) => r.region)).size >= 2) shared.push({ qid, rows: group });
    group = [];
  };
  for (const r of sorted) {
    if (group.length && r.date.year - group[0].date.year > 1) flush();
    group.push(r);
  }
  flush();
}
shared.sort((a, b) => a.rows[0].date.year - b.rows[0].date.year);

// ── 쓰기 ──────────────────────────────────────────────────────────────────
const out = [];
out.push("# 교차 사건 후보 — 판정 목록");
out.push("");
out.push(`만든 날 ${new Date().toISOString().slice(0, 10)} · \`node tools/probe-cross.mjs\`로 다시 만든다(판정 칸은 새로 비워진다 — 적은 뒤 옮겨 두고 다시 돌린다).`);
out.push("");
out.push("판정 칸에 **○**(맞다) · **×**(아니다) · **△**(모르겠다)를 적는다. ○인 것은 `curation/qid-fix.json`에 옮긴다 —");
out.push("그 파일의 `from`이 지금 QID, `qid`가 그 사건의 QID다. 기계 제안은 **한쪽만 사건 유형일 때**만 낸다. 참고용이다.");
out.push("");
out.push(`## ① 합칠 때 QID가 서로 달랐던 줄 — ${conflicts.length}건`);
out.push("");
out.push("같은 열·같은 해에 같은 사건으로 판정돼 한 줄로 합쳐졌는데, 두 줄이 서로 다른 위키데이터 항목을 가리켰다.");
out.push("발행은 **대표 줄의 QID를 그대로** 둔다. 사라진 쪽이 그 사건이면 교차 묶기와 관점별 명칭이 틀린 항목을 쓰고 있다.");
out.push("");
out.push("| # | 열 · 해 | 대표 줄(발행에 남음) | 대표 QID | 사라진 줄의 QID | 기계 제안 | 판정 |");
out.push("|---|---|---|---|---|---|---|");
conflicts
  .sort((a, b) => a.primary.region.localeCompare(b.primary.region) || a.primary.date.year - b.primary.date.year)
  .forEach(({ primary, dropped }, i) => {
    out.push(`| ${i + 1} | ${REGION_KO[primary.region]} ${primary.date.year} | ${cell(labelOf(primary))} | ${cell(qidText(primary.qid))} | ${cell(qidText(dropped.qid))} | ${suggestFor({ primary, dropped })} |  |`);
  });
out.push("");
out.push(`## ② 여러 열이 같은 인물·나라에 붙은 줄 — ${shared.length}묶음`);
out.push("");
out.push("같은 해(±1)에 두 열 이상이 **사건이 아닌** 같은 항목을 가리킨다. 임진왜란이 이 꼴이었다(일본·중국 줄이 도요토미 히데요시).");
out.push("같은 사건을 적었으면 ○와 함께 그 사건을 적는다. 그 사건의 QID를 찾는 것은 다음 단계다.");
out.push("");
out.push("**「기타」이면서 붙은 항목의 이름이 사건 이름인 것**(예: 「히로시마·나가사키 원자폭탄 투하」)은 꼴이 다르다 —");
out.push("QID는 맞고, 그 항목의 위키데이터 유형이 사건 유형 목록(`tools/event-kind.mjs`)에 없어 사건 판정만 빠진 것이다.");
out.push("그때는 QID를 고칠 일이 아니라 **사건으로 인정**하면 된다. 판정 칸에 「사건 인정」이라 적는다.");
out.push("");
out.push("| # | 붙은 항목 | 해 | 줄(열 · 발행 id · 이름) | 판정 · 사건 |");
out.push("|---|---|---|---|---|");
shared.forEach(({ qid, rows }, i) => {
  const ys = [...new Set(rows.map((r) => r.date.year))].join("·");
  const lines = rows.map((r) => `${REGION_KO[r.region]} \`${eventId(r)}\` ${cell(labelOf(r))}`).join("<br>");
  out.push(`| ${i + 1} | ${cell(qidText(qid))} | ${ys} | ${lines} |  |`);
});
out.push("");

mkdirSync("curation/_probe", { recursive: true });
writeFileSync("curation/_probe/cross-candidates.md", out.join("\n"));
console.log(`① QID 충돌 ${conflicts.length}건 (기계 제안 있음 ${conflicts.filter((c) => suggestFor(c) !== "—").length}) · ② 공유 비사건 QID ${shared.length}묶음 → curation/_probe/cross-candidates.md`);
