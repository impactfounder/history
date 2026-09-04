/**
 * 발행 — data-model §4-2 [발행] + §6 정적 JSON 포맷.
 *
 * `curation/events/{region}.jsonl`(원본)에서 `public/data/v1/`(파생물)을 만든다.
 * 읽기 경로는 이 정적 파일뿐이다 — 서버도 DB도 없다(PRD §8).
 *
 * 레벨별 청크(§5-3 임계값)
 *   century/all.json          중요도 5
 *   decade/{100년}.json        중요도 ≥ 4
 *   year/{10년}.json           전부
 * 파일 단위가 행 단위보다 한 자릿수 큰 이유는 §6-1 — 네이티브 관성 스크롤이
 * 축을 빠르게 훑기 때문이다. 키는 axis.ts의 chunkKeyFor와 같아야 한다.
 *
 * 요약문·출처는 detail/{id}.json에만 둔다(§6-1). 수집 원문(source_text)은
 * **어디에도 내보내지 않는다** — 위키 문장을 제품에 다시 싣지 않는다(editorial-policy §1-6).
 *
 * 사용:
 *   node tools/publish.mjs                  status=published만 (제품)
 *   node tools/publish.mjs --stage preview  needs_review·reviewed도 포함 (개발 미리보기)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "public/data/v1";
const stage = process.argv.includes("--stage") ? process.argv[process.argv.indexOf("--stage") + 1] : "published";
const ACCEPT = stage === "preview" ? new Set(["needs_review", "reviewed", "published"]) : new Set(["published"]);

/** 기본 4열(PRD §5-2). 미국은 1607년부터 수록(§11 C-3). 정치체 밴드는 M1 수작업 후. */
const REGIONS = [
  { id: "kr", label_ko: "한국" },
  { id: "cn", label_ko: "중국" },
  { id: "jp", label_ko: "일본" },
  { id: "us", label_ko: "미국", coverage_from: 1607 },
];

/** 사이트링크 언어 → 열. 관점 명칭의 원문(editorial-policy §3-1). */
const LANG_TO_REGION = { ko: "kr", zh: "cn", ja: "jp", en: "us" };

const sha = (s) => createHash("sha256").update(s).digest("hex");
const eventId = (r) => "ev_" + sha(`${r.source_id}|${r.title_ko}`).slice(0, 12);
const bucket = (y, u) => Math.floor(y / u) * u;
const formatYear = (y, approx) => (y <= 0 ? `기원전 ${1 - y}년` : `${y}년`) + (approx ? "경" : "");

function toRecord(r) {
  const names = { [r.region]: { ko: r.title_ko } };
  for (const [lang, title] of Object.entries(r.names_native ?? {})) {
    const region = LANG_TO_REGION[lang];
    if (!region || region === r.region) continue;
    names[region] = { nat: title, lang };
  }
  return {
    id: eventId(r),
    kind: "point",
    y0: r.date.year,
    prec: r.date.precision ?? "year",
    approx: Boolean(r.date.approximate),
    hist: r.historicity ?? "historical",
    title: r.title_ko,
    names,
    cat: r.category,
    scope: r.scope,
    regions: [{ r: r.region, imp: r.importance_auto, role: "primary" }],
    date_ko: formatYear(r.date.year, r.date.approximate),
  };
}

function toDetail(r, id) {
  return {
    id,
    title: r.title_ko,
    summary: r.summary_ko,
    review_note: r.review_note,
    status: r.status,
    src: [{ url: r.source.url, revid: r.source.revid, accessedAt: r.source.accessedAt, license: r.source.license }],
  };
}

// ── 읽기 ────────────────────────────────────────────────────────────────────
const dir = "curation/events";
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".jsonl")) : [];
const all = [];
const skipped = { status: 0, period: 0 };
for (const f of files) {
  for (const line of readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (!ACCEPT.has(r.status)) { skipped.status++; continue; }
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
}

const counts = { events: all.length, byRegion: Object.fromEntries(REGIONS.map((x) => [x.id, all.filter((r) => r.region === x.id).length])), byLevel, skipped };
write("manifest.json", { version: "v1", stage, publishedAt: new Date().toISOString(), counts, chunks });

console.log(`발행 — stage=${stage} → ${OUT}
  사건        ${all.length}  (${Object.entries(counts.byRegion).map(([k, v]) => `${k} ${v}`).join(" · ")})
  제외        status ${skipped.status} · period ${skipped.period}
  청크 수록   century ${byLevel.century} · decade ${byLevel.decade} · year ${byLevel.year}
  파일        ${Object.keys(chunks).length}`);
