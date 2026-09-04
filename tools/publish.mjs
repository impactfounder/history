/**
 * 발행 — data-model §4-2 [발행] + §6 정적 JSON 포맷.
 *
 * `curation/events/{region}.jsonl`(tools/derive.mjs 출력, 원본)에서 `public/data/v1/`(파생물)을 만든다.
 * 읽기 경로는 이 정적 파일뿐이다 — 서버도 DB도 없다(PRD §8).
 *
 * 레벨별 청크(§5-3 임계값)
 *   century/all.json          중요도 5
 *   decade/{100년}.json        중요도 ≥ 4
 *   year/{10년}.json           전부
 * 파일 단위가 행 단위보다 한 자릿수 큰 이유는 §6-1 — 네이티브 관성 스크롤이
 * 축을 빠르게 훑기 때문이다. 키는 axis.ts의 chunkKeyFor와 같아야 한다.
 *
 * 본문(원문 줄)·출처는 detail/{id}.json에만 둔다(§6-1). 원문은 라이선스와 함께 나간다 —
 * 위키백과 CC BY-SA 4.0, 국사편찬위원회 KOGL(editorial-policy §1-6, 2026-09-05).
 *
 * [한국] official/kr/{연도}.json — "이 해의 공식 연표 N건". 국사편찬위 항목 그대로, 한 해 80건까지.
 *        사건이 있는 해만 만든다(전체 1,922년 × 최대 5,551건은 너무 크다).
 *
 * 사용:
 *   node tools/publish.mjs                  status=published (제품)
 *   node tools/publish.mjs --stage preview  같은 데이터, manifest.stage만 preview (개발 배지)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "public/data/v1";
const stage = process.argv.includes("--stage") ? process.argv[process.argv.indexOf("--stage") + 1] : "published";
const OFFICIAL_PER_YEAR = 80;

/** 기본 4열(PRD §5-2). 미국은 1607년부터 수록(§11 C-3). 정치체 밴드는 M1 수작업 후. */
const REGIONS = [
  { id: "kr", label_ko: "한국" },
  { id: "cn", label_ko: "중국" },
  { id: "jp", label_ko: "일본" },
  { id: "us", label_ko: "미국", coverage_from: 1607 },
];

/** 사이트링크 언어 ↔ 열. 관점 명칭의 원문(editorial-policy §3-1). */
const LANG_TO_REGION = { ko: "kr", zh: "cn", ja: "jp", en: "us" };
const REGION_LANG = { kr: "ko", cn: "zh", jp: "ja", us: "en" };
const GENERAL_DB = new Set(["고대사연표", "근대사연표", "대한민국사연표"]);

const sha = (s) => createHash("sha256").update(s).digest("hex");
const eventId = (r) => "ev_" + sha(`${r.source_id}|${r.title}`).slice(0, 12);
const bucket = (y, u) => Math.floor(y / u) * u;
const yearKo = (y) => (y <= 0 ? `기원전 ${1 - y}년` : `${y}년`);
const formatYear = (y, approx) => yearKo(y) + (approx ? "경" : "");
/** 국사편찬위 날짜 → "1882년 음력 6월 9일". 모르는 달·날은 뺀다. */
const formatNikhDate = (d) =>
  yearKo(d.y) + (d.m ? ` ${d.cal === "lunar" ? "음력 " : ""}${d.m}월` : "") + (d.d ? ` ${d.d}일` : "") + (d.leap ? "(윤달)" : "");

function toRecord(r) {
  // 열마다 그 열의 언어판 표제어. 영어 원천의 한국 사건이라도 한국 열 이름은 ko 표제어다
  const names = {};
  for (const [lang, title] of Object.entries(r.names_native ?? {})) {
    const region = LANG_TO_REGION[lang];
    if (region && REGION_LANG[region] === lang) names[region] = { nat: title, lang };
  }
  const official = r.sources.filter((s) => s.kind === "nikh").length;
  return {
    id: eventId(r),
    kind: "point",
    y0: r.date.year,
    prec: r.date.precision ?? "year",
    approx: Boolean(r.date.approximate),
    hist: r.historicity ?? "historical",
    title: r.title,
    lang: r.lang,
    names,
    regions: [{ r: r.region, imp: r.importance_auto, role: "primary" }],
    date_ko: formatYear(r.date.year, r.date.approximate),
    ...(official ? { official } : {}),
  };
}

function toDetail(r, id) {
  return {
    id,
    title: r.title,
    text: r.text,
    lang: r.lang,
    year: r.date.year,
    license: "CC BY-SA 4.0", // text의 라이선스(위키백과)
    official: r.sources
      .filter((s) => s.kind === "nikh")
      .map((s) => ({ id: s.id, db: s.db, series: s.series, date_ko: formatNikhDate(s.date), text: s.text, url: s.url, license: s.license })),
    // 병합된 다른 언어판 줄의 원문(derive.mjs mergeDuplicates)
    alt: r.sources.filter((s) => s.kind === "wikipedia" && s.alt).map((s) => ({ lang: s.lang, text: s.text, url: s.url })),
    src: r.sources.filter((s) => s.kind === "wikipedia").map((s) => ({ url: s.url, revid: s.revid, accessedAt: s.accessedAt, license: s.license })),
  };
}

// ── 읽기 ────────────────────────────────────────────────────────────────────
const dir = "curation/events";
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".jsonl")) : [];
const all = [];
const skipped = { rejected: 0, period: 0 };
for (const f of files) {
  for (const line of readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.status !== "published") { skipped.rejected++; continue; }
    if (r.kind === "period") { skipped.period++; continue; } // 시대 구분은 polities로(§3-6)
    all.push(r);
  }
}

// ── 쓰기 ────────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const chunks = {};
const write = (rel, obj) => {
  const p = path.join(OUT, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  const body = JSON.stringify(obj);
  writeFileSync(p, body);
  chunks[rel] = sha(body);
};

write("regions.json", { regions: REGIONS });

const byLevel = { century: 0, decade: 0, year: 0 };
let officialMatched = 0;
for (const region of REGIONS.map((x) => x.id)) {
  const rs = all.filter((r) => r.region === region);
  if (!rs.length) continue;
  const recs = rs.map(toRecord);
  const sortKey = (a, b) => b.regions[0].imp - a.regions[0].imp || a.y0 - b.y0 || (a.id < b.id ? -1 : 1);

  const groups = {
    century: { all: recs.filter((e) => e.regions[0].imp >= 5) },
    decade: {},
    year: {},
  };
  for (const e of recs) {
    if (e.regions[0].imp >= 4) (groups.decade[bucket(e.y0, 100)] ??= []).push(e);
    (groups.year[bucket(e.y0, 10)] ??= []).push(e);
  }
  for (const [level, byKey] of Object.entries(groups)) {
    for (const [key, events] of Object.entries(byKey)) {
      if (!events.length) continue;
      events.sort(sortKey); // §6-2: imp desc, y0 asc, id asc — 클라이언트는 재정렬하지 않는다
      write(`events/${region}/${level}/${key}.json`, { region, level, key, count: events.length, events });
      byLevel[level] += events.length;
    }
  }
  for (const r of rs) write(`events/detail/${eventId(r)}.json`, toDetail(r, eventId(r)));
  officialMatched += recs.filter((e) => e.official).length;
}

// ── [한국] 이 해의 공식 연표 ────────────────────────────────────────────────
let officialYears = 0, officialEntries = 0;
const nikhFile = "curation/raw/nikh/timeline.jsonl";
if (existsSync(nikhFile) && all.some((r) => r.region === "kr")) {
  const years = new Set(all.filter((r) => r.region === "kr").map((r) => r.date.year));
  const byYear = new Map();
  for (const line of readFileSync(nikhFile, "utf8").split("\n").filter(Boolean)) {
    const n = JSON.parse(line);
    if (!years.has(n.date.y)) continue;
    (byYear.get(n.date.y) ?? byYear.set(n.date.y, []).get(n.date.y)).push(n);
  }
  const index = {};
  const dateKey = (n) => (n.date.m ?? 13) * 32 + (n.date.d ?? 32);
  for (const [y, ns] of byYear) {
    // 일반 연표 먼저, 그 안에서 날짜순. 80건이 넘으면 자르되 count는 전체를 알려준다
    ns.sort((a, b) => (GENERAL_DB.has(a.db) ? 0 : 1) - (GENERAL_DB.has(b.db) ? 0 : 1) || dateKey(a) - dateKey(b));
    const entries = ns.slice(0, OFFICIAL_PER_YEAR).map((n) => ({ id: n.id, db: n.db, series: n.series, date_ko: formatNikhDate(n.date), text: n.text, url: n.url }));
    write(`official/kr/${y}.json`, { year: y, count: ns.length, shown: entries.length, license: "KOGL 제1유형(이용허락범위 제한 없음)", entries });
    index[y] = ns.length;
    officialYears++;
    officialEntries += entries.length;
  }
  write("official/kr/index.json", { region: "kr", source: "국사편찬위원회 연표", years: index });
}

const counts = {
  events: all.length,
  byRegion: Object.fromEntries(REGIONS.map((x) => [x.id, all.filter((r) => r.region === x.id).length])),
  byLevel,
  officialMatched,
  officialYears,
  skipped,
};
write("manifest.json", { version: "v1", stage, publishedAt: new Date().toISOString(), counts, chunks });

console.log(`발행 — stage=${stage} → ${OUT}
  사건        ${all.length}  (${Object.entries(counts.byRegion).map(([k, v]) => `${k} ${v}`).join(" · ")})
  제외        rejected ${skipped.rejected} · period ${skipped.period}
  청크 수록   century ${byLevel.century} · decade ${byLevel.decade} · year ${byLevel.year}
  공식 출처   매칭 사건 ${officialMatched} · 연도 파일 ${officialYears} (항목 ${officialEntries})
  파일        ${Object.keys(chunks).length}`);
