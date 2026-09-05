/**
 * 국사편찬위원회 주제별 연표 → 한국 열 사건 (대표 결정 2026-09-05).
 *
 * A-16은 국사편찬위 연표를 "출처·날짜·깊이"로만 썼다. 고려·조선(938~1859)이 위키백과만으로는
 * 235건·십년 버킷 75/93으로 성겨서, **선별에도** 쓰기로 넓힌다. 다만 전부는 아니다 —
 * 그 구간 9,766행 중 기상재해 5,306·장시 1,345는 "그 해 그 나라에 무슨 일"이 아니다(PRD §4).
 * 아래 SERIES만 싣는다.
 *
 * 원문 그대로 + 공공누리 제1유형(editorial-policy §1-6) — 한국어라 번역이 필요 없다.
 * QID가 없으므로 중요도 2 → 연도 레벨에서만 보인다. 세기·십년 화면은 위키 선별 그대로다.
 *
 * 출력: curation/events/kr-nikh.jsonl (derive가 만드는 kr.jsonl과 나란히, publish가 둘 다 읽는다)
 * 사용: node tools/nikh-events.mjs
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "curation/raw/nikh/timeline.jsonl";
const OUT = "curation/events/kr-nikh.jsonl";
/** 실을 연표와 구간. 고려·조선만 — 그 앞뒤는 위키 + 고대사·근대사 연표가 이미 덮는다. */
const SERIES = new Set(["주제별연표_ch_wa", "주제별연표_ch_fa", "주제별연표_ch_se", "주제별연표_ch_mo", "주제별연표_ch_wo", "영남유학연표"]);
const FROM = 938, TO = 1859;
/** 한 해에 이만큼까지만 — 한 해가 한 연표로 뒤덮이지 않게. */
const PER_YEAR = 6;

if (!existsSync(SRC)) {
  console.error(`${SRC} 없음 — tools/fetch-nikh.mjs를 먼저 돌려라.`);
  process.exit(1);
}

/** 본문 앞머리의 "(태조 26년 4월)" 같은 왕대 표기를 제목에서 뗀다 — 날짜는 date에 이미 있다. */
const stripReign = (s) => s.replace(/^\s*\((?:[^()]|\([^()]*\))*\)\s*/, "").trim();
/** 출전 표시(≪고려사≫ 오행지, 쪽수)를 제목에서만 뗀다. 본문(text)은 원문 그대로 남긴다. */
const titleOf = (s) => {
  const t = stripReign(s).split(/≪|《|〈/)[0].trim();
  return (t.length >= 6 ? t : stripReign(s)).replace(/\s+/g, " ").slice(0, 120);
};

const rows = readFileSync(SRC, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((n) => SERIES.has(n.db) && n.date.y >= FROM && n.date.y <= TO && (n.text ?? "").trim().length >= 12);

// 연도별 상한. 같은 해 안에서는 날짜 있는 것 먼저, 그다음 짧은 것(초점이 좁다)
const byYear = new Map();
for (const n of rows) (byYear.get(n.date.y) ?? byYear.set(n.date.y, []).get(n.date.y)).push(n);
const out = [];
const stat = {};
for (const [y, ns] of [...byYear].sort((a, b) => a[0] - b[0])) {
  ns.sort((a, b) => (b.date.m ? 1 : 0) - (a.date.m ? 1 : 0) || a.text.length - b.text.length);
  for (const n of ns.slice(0, PER_YEAR)) {
    stat[n.db] = (stat[n.db] ?? 0) + 1;
    out.push({
      source_id: "nikh_" + createHash("sha1").update(n.id).digest("hex").slice(0, 12),
      status: "published",
      region: "kr",
      kind: "event",
      date: { year: y, precision: "year", era: "ad", ...(n.date.m ? { month: n.date.m } : {}), ...(n.date.d ? { day: n.date.d } : {}) },
      historicity: "historical",
      lang: "ko",
      title: titleOf(n.text),
      text: n.text,
      importance_auto: 2, // QID가 없다 — 연도 레벨에서만
      sources: [{ kind: "nikh", id: n.id, db: n.db, series: n.series, date: n.date, text: n.text, url: n.url, license: "KOGL 제1유형(이용허락범위 제한 없음)", primary: true }],
      derivedAt: new Date().toISOString(),
    });
  }
}
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");

const decades = new Set(out.map((r) => Math.floor(r.date.year / 10)));
console.log(`국사편찬위 주제별 연표 → ${OUT}
  후보 ${rows.length} → 수록 ${out.length} (해마다 ${PER_YEAR}건까지)
  연표별 ${Object.entries(stat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(/^주제별연표_/, "")} ${v}`).join(" · ")}
  덮인 십년 ${decades.size} / ${Math.floor(TO / 10) - Math.floor(FROM / 10) + 1}`);
