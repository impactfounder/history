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
  /*
    순서가 곧 연도 페이지의 열 순서다 — 그리드의 COLUMNS와 맞춰야 한 제품으로 읽힌다.
    ai에 coverage_from을 두지 않는다: 이 연표는 고대(기원전 10세기 언사의 기계 인형)부터
    다루므로 하한이 없는 것이 사실이다. **성긴 것과 미수록은 다르다.**
  */
  { id: "ai", label_ko: "AI" },
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
/**
 * 사건 id. 연도를 넣는다 — 수집기의 행 id는 sha1(url|revid|text)라 **같은 문장이 여러 해에 반복되면**
 * 같은 id가 된다("Rebellion breaks out in Sichuan"이 송 연표에 네 번, 2026-09-05 중복 키 경고).
 */
const eventId = (r) => "ev_" + sha(`${r.source_id}|${r.date.year}|${r.title}`).slice(0, 12);
/**
 * 지은 사건 제목(tools/name.mjs). 키는 sha1(lang|원문 한 줄)로 translate.mjs와 같은 공간이다.
 *
 * **derive.mjs가 아니라 여기서 붙인다.** 국사편찬위 줄(kr-nikh.jsonl)은 derive를 거치지 않고
 * publish가 직접 읽는 별도 파일이라, derive에 붙이면 2,143건이 통째로 샌다. 두 원천을 모두
 * 보는 곳은 publish뿐이다.
 *
 * name이 null인 줄도 캐시에 있다("이름을 못 짓겠다"도 결론이다) — 그 경우 필드를 만들지 않고
 * UI가 지금처럼 원문 문장을 쓴다.
 */
const nameHash = (lang, text) => createHash("sha1").update(`${lang}|${text}`).digest("hex").slice(0, 16);
const names_ko = new Map(
  existsSync("curation/names/ko.jsonl")
    ? readFileSync("curation/names/ko.jsonl", "utf8").split("\n").filter(Boolean)
        // 덧붙이는 중인 캐시를 읽으면 마지막 줄이 잘려 있을 수 있다. 한 줄 때문에 발행이
        // 통째로 죽지 않게 한다 — 이 캐시는 없으면 없는 대로 도는 선택적 입력이다.
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((n) => n?.name).map((n) => [n.h, n])
    : [],
);

/**
 * 겹친 제목의 판정(tools/dedupe.mjs). 같은 열·같은 해에 같은 제목이 둘 이상일 때,
 * 합칠 것인지(같은 사건) 각자 다른 제목을 줄 것인지(한 캠페인의 다른 국면) 판단한 결과다.
 * 보류(same:null)는 아무 키도 만들지 않는다 — 손대지 않으면 오늘 동작(원문 문장)이 남는다.
 */
const clash = { drop: new Map(), rename: new Map() };
if (existsSync("curation/names/clash.jsonl")) {
  for (const l of readFileSync("curation/names/clash.jsonl", "utf8").split("\n").filter(Boolean)) {
    let d; try { d = JSON.parse(l); } catch { continue; }
    if (d.same === true) for (const id of d.drop ?? []) clash.drop.set(id, d.primary);
    else if (d.same === false) for (const [id, n] of Object.entries(d.rename ?? {})) clash.rename.set(id, n);
  }
}

const bucket = (y, u) => Math.floor(y / u) * u;
const yearKo = (y) => (y <= 0 ? `기원전 ${1 - y}년` : `${y}년`);
const formatYear = (y, approx) => yearKo(y) + (approx ? "경" : "");
/** 국사편찬위 날짜 → "1882년 음력 6월 9일". 모르는 달·날은 뺀다. */
const formatNikhDate = (d) =>
  yearKo(d.y) + (d.m ? ` ${d.cal === "lunar" ? "음력 " : ""}${d.m}월` : "") + (d.d ? ` ${d.d}일` : "") + (d.leap ? "(윤달)" : "");

/**
 * 이 줄의 지은 제목. dedupe가 「다른 국면」이라 판정해 새 제목을 준 줄은 그것이 이긴다 —
 * 같은 열·같은 해에 같은 이름이 겹치던 것을 푼 결과이므로 원래 이름보다 구체적이다.
 */
const nameOf = (r) => clash.rename.get(r.source_id) ?? names_ko.get(nameHash(r.lang, r.title))?.name ?? null;

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
    ...(r.date.month ? { m: r.date.month } : {}),
    // 기간 사건의 끝 연도(derive.mjs endYearOf) — 그리드가 기간 막대를 그린다
    ...(r.date.end_year ? { y1: r.date.end_year } : {}),
    approx: Boolean(r.date.approximate),
    hist: r.historicity ?? "historical",
    title: r.title,
    ...(r.title_ko ? { title_ko: r.title_ko } : {}),
    // 지은 제목(tools/name.mjs). 원문 표제어가 사건 꼴이 아닐 때 칩·상세 제목이 된다.
    // 원문은 title/text에 그대로 있고 상세가 그것을 보여 준다 — 진본이 바뀌는 게 아니다.
    ...(nameOf(r) ? { name_ko: nameOf(r) } : {}),
    // 위키데이터 구조 라벨("accession" 재위 시작) — UI가 언어별 "즉위"를 붙인다
    ...(r.role ? { role: r.role } : {}),
    // 짧은 설명(한국어 위키백과 description, "일본의 무장" 같은 한 구) — 칩 툴팁용
    ...(r.about?.description ? { desc: r.about.description } : {}),
    lang: r.lang,
    names,
    regions: [{ r: r.region, imp: r.importance_auto, role: "primary" }],
    // 같은 중요도 안의 순서(언어판 수). 셀이 좁을 때 어느 것을 먼저 보일지 — 연도순이면 "겨울연가"가 세기 대표가 된다
    ...(r.rank_score ? { sl: r.rank_score } : {}),
    date_ko: formatYear(r.date.year, r.date.approximate),
    ...(official ? { official } : {}),
  };
}

function toDetail(r, id) {
  // 국사편찬위가 1차 출처인 줄(tools/nikh-events.mjs)은 본문이 official[]에 그대로 있다 — 두 번 싣지 않는다
  const nikhPrimary = r.sources[0]?.kind === "nikh" && r.sources[0]?.primary;
  return {
    id,
    title: r.title,
    ...(nikhPrimary ? {} : { text: r.text }),
    // 기계 번역(tools/translate.mjs). 원문이 진본이고 번역은 파생물 — UI가 "기계 번역"이라 표시한다
    ...(r.title_ko ? { text_ko: r.title_ko, mt: r.mt } : {}),
    // 지은 제목의 출처. 제목이 파생물이라는 사실을 상세가 들고 있어야 표시할 수 있다
    ...(nameOf(r)
      ? { name_ko: nameOf(r), name_mt: { model: names_ko.get(nameHash(r.lang, r.title))?.model ?? null, at: names_ko.get(nameHash(r.lang, r.title))?.at ?? null } }
      : {}),
    lang: r.lang,
    year: r.date.year,
    license: nikhPrimary ? "KOGL 제1유형(이용허락범위 제한 없음)" : "CC BY-SA 4.0", // 본문의 라이선스
    official: r.sources
      .filter((s) => s.kind === "nikh")
      .map((s) => ({ id: s.id, db: s.db, series: s.series, date_ko: formatNikhDate(s.date), text: s.text, url: s.url, license: s.license })),
    // 설명: 연결 문서의 한국어 위키백과 첫 문단(tools/summaries.mjs). 원문 그대로 + 출처
    ...(r.about ? { about: r.about } : {}),
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

/*
  겹친 제목 합치기(tools/dedupe.mjs 판정). 사라지는 줄의 원문은 대표의 sources에 `alt: true`로
  옮긴다 — derive.mjs mergeDuplicates가 쓰는 모양 그대로라 toDetail의 `alt`가 그대로 집어 간다.
  "같은 사건을 중국·일본·미국 연표가 어떻게 쓰는가"가 한 패널에 모이는 것이 이 제품의 주장이므로,
  합치기는 **행을 지우는 일이 아니라 관점을 모으는 일**이다. 국사편찬위 항목도 함께 옮긴다.
*/
const byId = new Map(all.map((r) => [r.source_id, r]));
let mergedRows = 0;
for (const r of all) {
  const into = clash.drop.get(r.source_id);
  const primary = into ? byId.get(into) : null;
  if (!primary || primary === r) continue;
  for (const src of r.sources) {
    if (src.kind === "wikipedia") primary.sources.push({ ...src, lang: r.lang, text: r.text, alt: true });
    else if (!primary.sources.some((p) => p.kind === src.kind && p.id === src.id)) primary.sources.push(src);
  }
  r.merged_into = into;
  mergedRows++;
}
const kept = all.filter((r) => !r.merged_into);
all.length = 0;
all.push(...kept);

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

/*
  열별 밀도 — 축 전체를 같은 폭 26칸으로 나눈 사건 수. 한 열이 **어디에 몰려 있는가**를
  숫자 스물여섯 개로 말한다.

  왜 발행에서 내보내는가: 이 계산은 사건 전부를 봐야 하는데, 그걸 아는 곳은 여기뿐이다.
  소비자는 지금 OG 이미지 하나지만(`src/app/opengraph-image.tsx`) 손으로 찍은 값 대신
  데이터를 쓰게 하려면 데이터가 나와 있어야 한다 — "모르는 것을 아는 척하지 않는다"는
  그림에도 적용된다.
*/
const DENSITY_BINS = 26;
const AXIS_FROM = -499, AXIS_TO = 2026;
const densityOf = (region) => {
  const bins = Array.from({ length: DENSITY_BINS }, () => 0);
  for (const r of all) {
    if (r.region !== region) continue;
    const t = (r.date.year - AXIS_FROM) / (AXIS_TO - AXIS_FROM + 1);
    if (t < 0 || t >= 1) continue; // 축 밖(예: 기원전 10세기 언사)은 세지 않는다
    bins[Math.floor(t * DENSITY_BINS)] += 1;
  }
  return bins;
};

write("regions.json", {
  regions: REGIONS.map((r) => {
    const density = densityOf(r.id);
    // 건수는 밀도의 합이다 — 축 밖은 발행 자체가 안 되므로(derive AXIS_START) 둘이 어긋나지 않는다
    return { ...r, count: density.reduce((a, b) => a + b, 0), density };
  }),
});

// ── 정치체 밴드 (tools/polities.mjs → curation/polities/{region}.json) ────────
// 약 40개라 한 파일. 가상화하지 않고 전부 렌더한다(PRD §5-5A 레이어 구조).
const polities = {};
for (const { id } of REGIONS) {
  const f = `curation/polities/${id}.json`;
  if (!existsSync(f)) continue;
  polities[id] = JSON.parse(readFileSync(f, "utf8")).map((p) => ({
    id: p.id, name: p.name_ko, names: p.names, y0: p.start_year, y1: p.end_year, hist: p.historicity,
    label: `${p.name_ko} ${yearKo(p.start_year).replace(/년$/, "")}–${p.end_year == null ? "" : yearKo(p.end_year).replace(/년$/, "")}`,
    ...(p.note ? { note: p.note } : {}),
  }));
}
write("polities.json", { regions: polities });

const byLevel = { century: 0, decade: 0, year: 0 };
let officialMatched = 0;
let spanDupes = 0;
let spanKept = 0;
for (const region of REGIONS.map((x) => x.id)) {
  const rs = all.filter((r) => r.region === region);
  if (!rs.length) continue;
  // id가 겹치면 앞의 것만 — 같은 해·같은 문서에 같은 줄이 두 번 있으면 클라이언트 key가 충돌한다
  const recs = [...new Map(rs.map((r) => [eventId(r), toRecord(r)])).values()];
  // 같은 기간이 여러 줄에 걸린 경우 막대는 하나만 남긴다(2026-09-09). id가 다르므로 위 dedupe가
  // 잡지 못한다 — 미국 열의 "1968 Civil rights movement 1954–1968"이 10겹, 의화단 운동이 2겹으로
  // 겹쳐 그려졌다. 3px 실선일 때는 묻혔지만 지속이 주 채널이 되면 전면에 뜬다.
  // 사건 자체는 지우지 않고 y1만 떼어 낸다 — 수록 건수와 +N 계산을 건드리지 않기 위해서다.
  const seenSpan = new Set();
  for (const e of recs) {
    if (e.y1 === undefined) continue;
    const key = `${e.y0}|${e.y1}|${e.title}`;
    if (seenSpan.has(key)) { delete e.y1; spanDupes++; } else seenSpan.add(key);
  }
  spanKept += seenSpan.size;
  // §6-2: imp desc → 언어판 수 desc → y0 asc → id. 클라이언트는 재정렬하지 않고 앞에서부터 셀 높이만큼 보인다
  const sortKey = (a, b) => b.regions[0].imp - a.regions[0].imp || (b.sl ?? 0) - (a.sl ?? 0) || a.y0 - b.y0 || (a.id < b.id ? -1 : 1);

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
// 원본(curation/raw/nikh, 131MB)은 레포 밖이다. 사건이 있는 해만 80건씩 추린 curation/nikh/official-years.json
// (약 3MB)을 추적해 두어, 원본이 없는 CI에서도 같은 파일을 발행한다. 원본이 있으면 추린 파일을 새로 쓴다.
let officialYears = 0, officialEntries = 0;
const nikhRaw = "curation/raw/nikh/timeline.jsonl";
const nikhSubset = "curation/nikh/official-years.json";
let official = null; // { [year]: { count, entries } }
if (existsSync(nikhRaw) && all.some((r) => r.region === "kr")) {
  const years = new Set(all.filter((r) => r.region === "kr").map((r) => r.date.year));
  const byYear = new Map();
  for (const line of readFileSync(nikhRaw, "utf8").split("\n").filter(Boolean)) {
    const n = JSON.parse(line);
    if (!years.has(n.date.y)) continue;
    (byYear.get(n.date.y) ?? byYear.set(n.date.y, []).get(n.date.y)).push(n);
  }
  const dateKey = (n) => (n.date.m ?? 13) * 32 + (n.date.d ?? 32);
  official = {};
  for (const [y, ns] of byYear) {
    // 일반 연표 먼저, 그 안에서 날짜순. 80건이 넘으면 자르되 count는 전체를 알려준다
    ns.sort((a, b) => (GENERAL_DB.has(a.db) ? 0 : 1) - (GENERAL_DB.has(b.db) ? 0 : 1) || dateKey(a) - dateKey(b));
    official[y] = { count: ns.length, entries: ns.slice(0, OFFICIAL_PER_YEAR).map((n) => ({ id: n.id, db: n.db, series: n.series, date_ko: formatNikhDate(n.date), text: n.text, url: n.url })) };
  }
  mkdirSync(path.dirname(nikhSubset), { recursive: true });
  writeFileSync(nikhSubset, JSON.stringify(official));
} else if (existsSync(nikhSubset)) {
  official = JSON.parse(readFileSync(nikhSubset, "utf8"));
}
if (official) {
  const index = {};
  for (const [y, o] of Object.entries(official)) {
    write(`official/kr/${y}.json`, { year: Number(y), count: o.count, shown: o.entries.length, license: "KOGL 제1유형(이용허락범위 제한 없음)", entries: o.entries });
    index[y] = o.count;
    officialYears++;
    officialEntries += o.entries.length;
  }
  write("official/kr/index.json", { region: "kr", source: "국사편찬위원회 연표", years: index });
}

const counts = {
  spans: { kept: spanKept, deduped: spanDupes },
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
  겹침 합침   ${mergedRows}행 (같은 열·같은 해·같은 제목 — 원문은 대표의 alt로)
  청크 수록   century ${byLevel.century} · decade ${byLevel.decade} · year ${byLevel.year}
  기간        막대 ${spanKept}건 (중복 제거 ${spanDupes})
  공식 출처   매칭 사건 ${officialMatched} · 연도 파일 ${officialYears} (항목 ${officialEntries})
  파일        ${Object.keys(chunks).length}`);
