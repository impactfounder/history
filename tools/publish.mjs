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
import { FOUND_VERB_STRONG, foundStrength, foundsNear, politiyCore } from "./founding.mjs";
import { eventId } from "./event-id.mjs";
import { pickMergedQid } from "./merge-qid.mjs";
import { isEventLike } from "./event-kind.mjs";
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
// 사건 id — tools/event-id.mjs (교정표 테스트가 같은 계산을 쓴다)
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
    // 나라·시대의 시작(아래 markFounding). 같은 중요도 안에서 sl보다 먼저 선다
    ...(r.founding ? { f: 1 } : {}),
    // 교차 사건 묶음 id — 같은 사건을 여러 열이 각자의 이름으로 적은 경우(아래)
    ...(r.cross ? { x: r.cross } : {}),
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
    // 딥링크(?e=)가 이 파일만 받아 보고 **어느 열을 켜고 어느 해로 갈지** 정한다.
    // 열이 꺼져 있으면 사건이 화면에 없고, 그러면 링크를 연 뜻이 없다.
    r: r.region,
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

/**
 * 사건 판정에 **쓰일 수 있는** QID — 합치기·교정 **전** 원본에서 센다(아래 FACTS_COPY). 두 열 이상의 줄에
 * 나오는 QID와 교정표가 가리키는 QID. 합친 뒤의 집합보다 넓지만 그래서 안전하다 — qid-facts.test.ts가
 * 같은 규칙으로 git 안의 원본만 보고 다시 셀 수 있다.
 */
const judgedQids = (() => {
  const regions = new Map();
  const add = (q, region) => q && (regions.get(q) ?? regions.set(q, new Set()).get(q)).add(region);
  for (const r of all) add(r.qid, r.region);
  const out = new Set([...regions].filter(([, s]) => s.size >= 2).map(([q]) => q));
  if (existsSync("curation/qid-fix.json")) {
    for (const f of JSON.parse(readFileSync("curation/qid-fix.json", "utf8")).fixes ?? []) out.add(f.qid);
  }
  return out;
})();

/*
  겹친 제목 합치기(tools/dedupe.mjs 판정). 사라지는 줄의 원문은 대표의 sources에 `alt: true`로
  옮긴다 — derive.mjs mergeDuplicates가 쓰는 모양 그대로라 toDetail의 `alt`가 그대로 집어 간다.
  "같은 사건을 중국·일본·미국 연표가 어떻게 쓰는가"가 한 패널에 모이는 것이 이 제품의 주장이므로,
  합치기는 **행을 지우는 일이 아니라 관점을 모으는 일**이다. 국사편찬위 항목도 함께 옮긴다.
*/
const byId = new Map(all.map((r) => [r.source_id, r]));
let mergedRows = 0;
let liftedRows = 0;
let qidInherited = 0;
let qidConflicts = 0;
let qidSwitched = 0;
for (const r of all) {
  const into = clash.drop.get(r.source_id);
  const primary = into ? byId.get(into) : null;
  if (!primary || primary === r) continue;
  for (const src of r.sources) {
    if (src.kind === "wikipedia") primary.sources.push({ ...src, lang: r.lang, text: r.text, alt: true });
    else if (!primary.sources.some((p) => p.kind === src.kind && p.id === src.id)) primary.sources.push(src);
  }
  /*
    **중요도는 묶음의 최댓값을 따른다.** 합치기는 행을 지우는 일이 아니라 관점을 모으는 일이므로
    (위 주석), 모인 것이 원래 대표보다 중요하면 그 사실도 함께 모여야 한다.

    그러지 않아서 벌어지던 일(2026-09-20 대표 지적 "국가 설립이 왜 안 나오냐"):

      대표  imp2 sl=없음  「8월 15일 대한민국 정부 수립」                 ← 국사편찬위, QID 없음
      버림  imp5 sl=82    「이승만을 대통령으로 하는 대한민국이 수립된다」  ← 위키, QID Q171684

    이름은 국편 쪽이 나아서 대표로 고른 것이 맞는데, **중요도가 위키 쪽에만 있었고 버려졌다.**
    세기 레벨은 imp>=5, 십년은 imp>=4만 실으므로 대한민국 정부 수립은 연도 레벨까지 확대해야만
    보였다. 실측: same=true 301묶음 중 **104묶음(35%)**이 이렇게 중요도를 잃고 있었다
    (2→5가 24 · 2→4가 50 · 2→3이 16 · 나머지 14).

    `rank_score`(발행의 `sl`, 같은 중요도 안의 정렬 키)도 같이 올린다 — 중요도만 올리고 정렬 키를
    두고 오면 같은 imp 안에서 맨 뒤에 서서 좁은 셀에서는 여전히 안 보인다.
  */
  const impBefore = primary.importance_auto ?? 0;
  primary.importance_auto = Math.max(impBefore, r.importance_auto ?? 0);
  primary.rank_score = Math.max(primary.rank_score ?? 0, r.rank_score ?? 0);
  if (primary.importance_auto > impBefore) liftedRows++;
  /*
    **QID와 관점별 명칭도 같은 이유로 모인다.** 위의 중요도와 똑같은 사고가 한 층 아래에 남아
    있었다(2026-09-25 진단 — PRD S3 「임진왜란이 세 열에 한 사건으로」가 데이터에 없던 원인):

      대표  QID 없음            「…절영도에 상륙. 임진왜란 시작.」      ← 국사편찬위
      버림  QID Q576338(임진왜란) 「…왜군이 조선을 침공하여 임진왜란이 발발」 ← 위키

    대표가 QID를 못 받으니 ① 교차 묶기(아래, QID로 묶는다)에 들어갈 수 없고 ② 상세의
    「이 사건을 부르는 이름」(文禄・慶長の役 · 萬曆朝鮮之役)이 비고 ③ 일본어·중국어 화면의
    라벨도 그 나라 표제어를 못 쓴다. 국편 줄이 대표가 되는 합침은 전부 이 꼴이다.

    대표가 **이미 다른 QID를 가졌으면 건드리지 않는다** — 어느 쪽이 맞는지는 이 자리에서 모른다.
  */
  if (!primary.qid && r.qid) {
    primary.qid = r.qid;
    primary.names_native = r.names_native;
    if (r.sitelinks != null) primary.sitelinks = r.sitelinks;
    if (!primary.about && r.about) primary.about = r.about;
    qidInherited++;
  } else if (primary.qid && r.qid && primary.qid !== r.qid) {
    /*
      서로 다른 QID — **표제어가 줄 이름과 같은 쪽**을 쓴다(tools/merge-qid.mjs, 대표 승인 2026-09-25).
      「황건적의 난」의 대표 QID가 장각(인물)이라 관점별 명칭이 사람 이름이었다. 바꿀 때는
      「관련 문서」(about — 그 QID의 한국어 위키백과 첫 문단)도 함께 옮긴다. 안 그러면 장각 전기가 남는다.
      둘 다 같거나 둘 다 다르면 그대로 둔다 — 사람 판정 목록(tools/probe-cross.mjs)으로 간다.
    */
    if (pickMergedQid(primary, r, nameOf(primary) ?? primary.title_ko ?? primary.title) === "take") {
      primary.qid = r.qid;
      primary.names_native = r.names_native;
      if (r.sitelinks != null) primary.sitelinks = r.sitelinks;
      primary.about = r.about;
      qidSwitched++;
    } else {
      qidConflicts++;
    }
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

/*
  **교차 사건 — 같은 사건을 여러 열이 각자의 이름으로 적은 것.**

  이 제품의 간판("같은 사건을 나라마다 다르게 부른다")인데 발행 데이터에 **0건**이었다 —
  `regions`가 늘 한 열 하드코딩이었다. 원재료는 있었다: 같은 QID가 2열 이상에 나오는 경우 **98개**.

  ── QID만으로는 안 된다 (2026-09-21 실측) ────────────────────────────────
  98개 중 **40개는 QID가 사건이 아니라 나라·개념**이었다. 「고구려」 QID가 기원전 36년 건국과
  668년 멸망을 한 사건으로 묶고, 「이탈리아」가 1601년 마테오 리치와 2019년 미국을 묶는다.
  그래서 `isEventLike`(tools/event-kind.mjs — 중요도 점수가 쓰는 것과 **같은 판정**)를 통과해야 한다.

  남은 58개 중 연도가 ±1 안인 것이 **56개**다. ±1을 받는 이유는 원천이 해를 달리 잡기 때문이다
  (병자호란 kr 1636 · cn 1637, 울산성 전투 kr 1597 · cn 1598). 그보다 벌어진 둘은 베트남 전쟁처럼
  **참전 시점이 나라마다 다른** 경우라 같은 사건으로 묶지 않는다 — 그것은 다른 국면이다.

  묶음은 `cross.json`으로 따로 낸다. 상세가 "다른 열은 이렇게 적었다"를 보여줄 때 **다른 열의
  청크를 받지 않고** 이름·해·id를 바로 쓸 수 있어야 한다.
*/
/*
  **QID 교정표**(`curation/qid-fix.json`). 줄의 QID가 사건이 아니라 인물·나라를 가리키면 위
  판정(`isEventLike`)이 그 줄을 교차 묶기에서 뺀다 — 맞는 판정이다. 그런데 그 줄이 말하는 것이
  사건이면 묶여야 한다. 1592년 임진왜란은 일본 열이 「도요토미 히데요시」에, 중국 열이 같은 인물과
  「조선」에 붙어 있어 세 열이 같은 전쟁을 적고도 한 묶음이 되지 못했다(2026-09-25 진단).

  기계로 고치지 않고 표로 고친다. "이 줄은 사실 이 사건을 말한다"는 역사 판단이라서다.
  `from`이 지금 QID와 맞을 때만 붙인다 — 원본이 바뀌었으면 옛 판단을 새 줄에 씌우지 않는다.
  이름은 그 사건 QID를 이미 가진 줄에서 가져온다(없으면 교정만 하고 이름은 그대로).
*/
let qidFixed = 0;
const qidFixStale = [];
if (existsSync("curation/qid-fix.json")) {
  const fixes = JSON.parse(readFileSync("curation/qid-fix.json", "utf8")).fixes ?? [];
  const namesByQid = new Map();
  for (const r of all) if (r.qid && r.names_native && !namesByQid.has(r.qid)) namesByQid.set(r.qid, r.names_native);
  const byEventId = new Map(all.map((r) => [eventId(r), r]));
  for (const f of fixes) {
    const r = byEventId.get(f.id);
    if (!r || r.qid !== f.from) {
      qidFixStale.push(f.id);
      continue;
    }
    r.qid = f.qid;
    if (namesByQid.has(f.qid)) r.names_native = namesByQid.get(f.qid);
    qidFixed++;
  }
}

/*
  **사건 판정 재료 — 로컬과 CI가 같은 것을 보게.**

  `isEventLike`는 이름 꼴과 위키데이터 유형(P31)을 본다. 유형은 수집 산출물 `curation/raw/_qid-sitelinks.json`에
  있는데 **그 폴더는 git 밖이다.** 그래서 Vercel 빌드는 유형 없이 이름만으로 판정했고, 배포본의 교차 묶음이
  로컬보다 적었다(2026-09-25 실측 52 대 55 — 코로나19 범유행 3열 · 2018 한일 레이더 사건 · 14개조 평화 원칙이
  배포본에만 없었다). 로컬에서 확인한 것이 배포되지 않는, 가장 알아채기 어려운 꼴이다.

  국사편찬위 원본이 없는 CI를 위해 `curation/nikh/official-years.json`을 추적하는 것과 같은 방식으로 푼다 —
  원본이 있으면 판정에 **쓰일 수 있는** QID의 사실만 추적되는 사본(`curation/qid-facts.json`)으로 쓰고,
  원본이 없으면 그 사본을 읽는다. "쓰일 수 있는" = 두 열 이상의 줄에 나오거나 교정표가 가리키는 QID
  (교차 묶기는 두 열 이상에서만 판정한다). `qid-facts.test.ts`가 사본이 그 집합을 다 덮는지 지킨다.
*/
const FACTS_RAW = "curation/raw/_qid-sitelinks.json";
const FACTS_COPY = "curation/qid-facts.json";
const qidFacts = (() => {
  if (existsSync(FACTS_RAW)) {
    const facts = JSON.parse(readFileSync(FACTS_RAW, "utf8")).facts ?? {};
    // 원본에 사실이 없는 QID도 빈 항목으로 적는다 — 판정은 같고(유형 없음), 테스트가 "사본이 판정 대상을
    // 다 덮는가"를 원본 없이도 셀 수 있다
    const keep = [...judgedQids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    // 한 줄에 하나 — 재발행의 차이가 줄 단위 diff로 읽힌다
    const lines = keep.map((q) => `    ${JSON.stringify(q)}: ${JSON.stringify({ ...(facts[q]?.human ? { human: true } : {}), types: facts[q]?.types ?? [] })}`);
    writeFileSync(
      FACTS_COPY,
      `{\n  "about": "사건 판정 사본 — tools/publish.mjs가 curation/raw/_qid-sitelinks.json에서 판정에 쓰일 수 있는 QID만 뽑아 쓴다. CI는 원본이 없어 이것을 읽는다. 손으로 고치지 않는다.",\n  "facts": {\n${lines.join(",\n")}\n  }\n}\n`,
    );
    return facts;
  }
  return existsSync(FACTS_COPY) ? (JSON.parse(readFileSync(FACTS_COPY, "utf8")).facts ?? {}) : {};
})();
const crossGroups = {};
{
  const byQid = new Map();
  for (const r of all) {
    if (!r.qid) continue;
    (byQid.get(r.qid) ?? byQid.set(r.qid, []).get(r.qid)).push(r);
  }
  for (const [qid, rs] of byQid) {
    if (new Set(rs.map((r) => r.region)).size < 2) continue;
    if (!isEventLike(rs[0], qidFacts)) continue;
    const ys = rs.map((r) => r.date.year);
    if (Math.max(...ys) - Math.min(...ys) > 1) continue;
    /*
      **열마다 한 줄만.** 같은 열에 같은 QID가 여러 줄 있는 일이 흔하다(의화단 운동은 중국 열에
      다섯 줄이다 — derive의 secondaryByQid가 그중 하나만 대표로 두고 나머지를 눌러 둔 그 상태다).
      전부 묶으면 "다른 열에서는" 목록이 같은 나라 이름으로 도배된다.
      열 안에서는 **중요도가 가장 높은 줄**이 그 열을 대표한다.
    */
    const perRegion = new Map();
    for (const r of rs) {
      const cur = perRegion.get(r.region);
      if (!cur || (r.importance_auto ?? 0) > (cur.importance_auto ?? 0)) perRegion.set(r.region, r);
    }
    if (perRegion.size < 2) continue;
    const gid = sha(qid).slice(0, 8);
    // 표시는 대표 줄만 하지만, **묶음 표시(x)는 그 열의 모든 줄**이 받는다 —
    // 가려진 줄을 클릭해도 "이 사건은 다른 열에도 있다"는 사실은 같다
    for (const r of rs) r.cross = gid;
    crossGroups[gid] = [...perRegion.values()]
      .map((r) => ({
        r: r.region,
        id: eventId(r),
        y: r.date.year,
        // 그 열의 **자국어 이름**. 이 기능의 뜻이 "중국은 이것을 义和团运动이라 부른다"이므로
        // 한국어 지은 제목이 아니라 그쪽 말이 와야 한다. 없으면 지은 제목으로 떨어진다.
        name: r.names_native?.[REGION_LANG[r.region]] ?? nameOf(r) ?? null,
      }))
      .sort((a, b) => (a.r < b.r ? -1 : 1));
  }
}
write("cross.json", { groups: crossGroups });

/*
  **나라의 시작은 그 해의 맨 앞에 선다** (대표 결정 2026-09-20: "국가 설립이 가장 중요한 것 아니냐").

  증상은 이랬다 — 세기 레벨 한국 열 1900년대에 「삼성 설립」·「남극 첫 탐험」·「엠폭스 유행」은
  있는데 **「대한민국 정부 수립」이 없었다.** 중요도가 위키백과 언어판 수에서 나오는데(derive.mjs
  score), 국내 연표에만 있는 사건은 언어판이 없어 구조적으로 눌린다.

  절반은 위 병합 수정(중요도 승계)이 풀었다. 나머지 절반이 **순서**다 — imp가 같으면 언어판 수로
  줄을 세우므로 「제주 4·3 사건」(sl 23)이 「대한민국 정부 수립」(sl 12) 앞에 섰다.

  **새로 알아내지 않는다.** 나라·시대의 시작 연도는 이미 `curation/polities/`에 있다(격자가 왕조
  밴드를 그리는 그 값). 그 해에서 그 이름을 건국 동사와 **가까이** 쓴 줄을 찾아 **정치체마다 한
  줄만** 고른다. 한 줄만 고르는 것이 오탐 방어다 — 진짜 건국 행이 있으면 점수로 그것이 이기므로,
  「중화인민공화국 성립 이래 최대의 탄광 사고」 같은 줄이 대표가 되는 일은 그 해에 진짜가 아예
  없을 때만 생긴다.

  일본 열의 정치체는 나라가 아니라 **시대**다(헤이안·에도·헤이세이). 그래서 이 표시는 "국가 설립"이
  아니라 "그 열의 시대가 바뀌는 지점"을 뜻하고, 일본에서는 그쪽이 같은 자리의 사실이다.
*/
let foundingRows = 0;
for (const { id } of REGIONS) {
  for (const p of polities[id] ?? []) {
    const core = politiyCore(p.name);
    if (!core) continue;
    /*
      **`nameOf(r)`를 함께 본다.** 지은 제목(tools/name.mjs)은 원본 행에 없고 이름 캐시에 있다 —
      처음 판이 `r.name_ko`를 읽어 늘 undefined였고, 그래서 「명나라 건국」·「송나라 건국」처럼
      가장 깨끗한 이름을 못 보고 원문만 봤다(실측: 1368년이 통째로 빠졌다).
    */
    const textOf = (r) => [nameOf(r), r.title_ko, r.title].filter(Boolean).join(" | ");
    /*
      후보는 **두 갈래**다.

        1) 본문이 정치체 이름을 건국 동사 곁에 쓴 줄 — 「고려 건국」·「대한민국 정부 수립」.
        2) **정확한 시작 해에 이름이 건국을 분명히 말하는 줄** — 정치체 이름을 요구하지 않는다.

      2)가 필요한 이유: 미국의 1776년 줄 이름은 「독립 선언문 공포」이고 「미국」이 없다. 1)만
      보면 미국 열은 그 해에 「스태튼아일랜드 평화 회의」를 골랐다 — 본문의 「미국의 독립 선언」이
      18자 창에 들었을 뿐 건국 행이 아니다. 이름 조건을 푸는 대신 **해를 ±0으로 조인다**.
      (2026-09-21 실측: 2)를 더해 채워지는 정치체가 25 → 30이 되고 미국의 오탐이 사라진다.)
    */
    const cand = all.filter((r) => {
      if (r.region !== id || Math.abs(r.date.year - p.y0) > 1) return false;
      if (foundsNear(textOf(r), core)) return true;
      return r.date.year === p.y0 && FOUND_VERB_STRONG.test(nameOf(r) ?? "");
    });
    if (!cand.length) continue;
    /*
      그 해의 대표 한 줄. 순서대로:

        1) **정치체가 말하는 바로 그 해** — ±1을 받아들이되 정확한 해가 이긴다. 이것이 없어서
           1393년 「국호 조선 개칭」이 1392년 「조선 건국」을 이겼다(마지막 동점 처리가 원문
           길이여서 사실상 자의적이었다).
        2) **이름이 시작을 얼마나 분명히 말하는가**(`foundStrength`) — 960년에는 「진교의 변」과
           「송나라 건국」이 함께 있다. 둘 다 같은 사건이어도 칩에 설 이름은 뒤쪽이다. 「즉위」가
           약한 말인 이유는 `founding.mjs`에 적었다.
        3) **이름이 이 정치체를 부르는가** — 1948년에는 「대한민국 정부 수립」과 「북한 정부
           수립」이 나란히 있다. 둘 다 2)에서 동점이라 이 줄이 없으면 갈리지 않는다. 같은 이유로
           581년의 「수나라 건국」이 「수 건국」을, 960년의 「송나라 건국」이 「북송 건국」을 이긴다.
           **본문이 아니라 이름만 본다** — 본문을 보면 위의 스태튼아일랜드 오탐이 되돌아온다.
        4) 중요도 · 순위 점수 · 이름 유무 · 짧은 원문.
    */
    const yearDist = (r) => Math.abs(r.date.year - p.y0);
    const namesCore = (r) => ((nameOf(r) ?? "").includes(core) ? 0 : 1);
    cand.sort(
      (a, b) =>
        yearDist(a) - yearDist(b) ||
        foundStrength(nameOf(a)) - foundStrength(nameOf(b)) ||
        namesCore(a) - namesCore(b) ||
        (b.importance_auto ?? 0) - (a.importance_auto ?? 0) ||
        (b.rank_score ?? 0) - (a.rank_score ?? 0) ||
        (nameOf(a) ? 0 : 1) - (nameOf(b) ? 0 : 1) ||
        (a.title?.length ?? 0) - (b.title?.length ?? 0),
    );
    const win = cand[0];
    win.founding = true;
    win.importance_auto = 5;
    foundingRows++;
  }
}

const byLevel = { century: 0, decade: 0, year: 0 };
let officialMatched = 0;
let spanDupes = 0;
/** 기간 프레임 원천(아래 루프가 채운다) → spans.json */
const spans = [];
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
  /*
    기간 프레임의 원천. **청크와 따로 내보낸다.**

    프레임은 지금까지 로드된 청크에서 파생했는데, 연도 레벨의 청크는 10년 단위라
    **시작 연도가 실리지 않은 구간에서는 프레임이 사라졌다.** 실측(2026-09-20): 133건 중
    39건(29%)이 10년 경계를 넘고, 쿠빌라이-카이두 전쟁(1268–1301)은 1272년에서는 그려지는데
    1295년에서는 0개였다. 한 파일로 내면 어느 지점에서 보든 같다.
  */
  for (const e of recs) {
    if (e.y1 === undefined) continue;
    spans.push({ r: region, id: e.id, y0: e.y0, y1: e.y1, ...(e.m ? { m: e.m } : {}), imp: e.regions[0]?.imp ?? 3 });
  }
  // §6-2: imp desc → **나라의 시작** → 언어판 수 desc → y0 asc → id.
  // 클라이언트는 재정렬하지 않고 앞에서부터 셀 높이만큼 보인다
  const sortKey = (a, b) =>
    b.regions[0].imp - a.regions[0].imp || (b.f ?? 0) - (a.f ?? 0) || (b.sl ?? 0) - (a.sl ?? 0) || a.y0 - b.y0 || (a.id < b.id ? -1 : 1);

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
      byLevel[level] += events.length;
      if (level !== "decade") {
        write(`events/${region}/${level}/${key}.json`, { region, level, key, count: events.length, events });
        continue;
      }
      /*
        **십년 청크는 앞부분과 뒷부분으로 나눈다**(2026-09-25, 진단 보고서 개선 8).

        첫 화면(1980년 · s=8)이 받는 데이터가 gzip 230KB였고 그중 219KB가 십년 청크 10개였다.
        그런데 s=8의 십년 칸(80px)에는 칩이 **3개**만 선다. 청크는 이 레벨의 최대 확대(420px,
        칸당 19개)를 대비해 전부를 싣고 있었다 — 중국 1900년대 한 파일이 364건이었다.

        칸은 청크 앞에서부터 높이 예산만큼 고르므로(layout-cell.ts), 행마다 **앞의 HEAD건**이면
        그 확대까지는 화면이 같다. 나머지는 `.more.json`에 같은 순서로 두고, 격자가 더 확대하거나
        「N건 더」 시트를 열 때만 받는다. 앞부분 + 뒷부분을 행마다 이어 붙이면 원래 순서가 된다.

        `head`와 `counts`(행별 총수)는 앞부분 파일이 스스로 싣는다 — 격자가 이 상수를 따로 들고
        있지 않아도 「N건 더」의 수와 뒷부분이 필요한지를 안다. 실측: 앞부분 6건이면 첫 화면의
        십년 청크가 219KB → 75KB(gzip), 칸당 6개는 s≈14까지 덮는다.

        연도 청크는 나누지 않는다 — 연도 페이지(year-data.ts)가 그 파일을 통째로 읽는다.
      */
      const HEAD = 6;
      const seen = new Map();
      const head = [];
      const more = [];
      const counts = {};
      for (const e of events) {
        const b = bucket(e.y0, 10);
        const n = seen.get(b) ?? 0;
        seen.set(b, n + 1);
        counts[b] = n + 1;
        (n < HEAD ? head : more).push(e);
      }
      write(`events/${region}/decade/${key}.json`, { region, level, key, count: events.length, head: HEAD, counts, events: head });
      if (more.length) write(`events/${region}/decade/${key}.more.json`, { region, level, key, count: more.length, events: more });
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
spans.sort((a, b) => a.y0 - b.y0 || a.r.localeCompare(b.r));
write("spans.json", { spans });

/*
  **열별로 사건이 있는 해.** 빈 구간 힌트(「다음 사건 1392년 ↓」, PRD §5-4 · M2 완료 조건)가
  쓴다. 청크로는 계산할 수 없다 — 청크는 보이는 구간만 게을리 받으므로 **빈 구간에서는 받을
  청크가 없고**, 그러면 다음 사건이 어디인지 아무것도 모른다.

  크기가 문제되지 않는다: 다섯 열 합쳐 3,711개 해이고 **델타(앞 값과의 차이)로 싣으면
  gzip 1.3KB**다(그대로는 5.3KB). 첫 로드에 얹어도 부담이 없고, 그래야 힌트가 첫 화면부터
  정확하다.
*/
const yearsByRegion = {};
for (const { id } of REGIONS) {
  const ys = [...new Set(all.filter((r) => r.region === id).map((r) => r.date.year))].sort((a, b) => a - b);
  const delta = [];
  let prev = 0;
  for (const y of ys) { delta.push(y - prev); prev = y; }
  yearsByRegion[id] = delta;
}
write("years.json", { years: yearsByRegion });

/*
  **검색 색인.** 11,393건을 쌓아 두고 이름으로 찾을 길이 없었다 — 앱 안 검색은 PRD §5-10 상단바
  도해(🔍)에 있는데 구현이 없었다.

  **첫 화면의 길에 두지 않는다.** 착지 데이터가 이미 예산(50KB)의 다섯 배다. 이 파일은 검색을
  **처음 열 때** 받는다(`src/lib/search.ts`). `data-budget.test.ts`가 그것을 지킨다.

  한 항목은 `[이름, 연도, 열, id, 중요도]`다.
   · **이름이 있는 것만** 싣는다. 지은 제목(name.mjs)이나 자국어 표제어가 없으면 찾을 이름 자체가
     없다 — 문장을 실으면 색인만 부풀고 질의는 안 맞는다.
   · **중요도를 함께** 싣는다. 「전쟁」처럼 수백 건이 맞는 질의를 줄 세우려면 필요하다.
   · id는 `ev_` 접두를 뗀다. 10,406건 × 3자 = 30KB가 그냥 사라진다.
   · 열·연도 순으로 정렬한다 — 같은 열의 비슷한 문자열이 붙어 있어야 gzip이 먹는다.
   · **영문 별칭**(6번째)을 이름과 다를 때만 붙인다. 이름은 대개 한국어 지은 제목이라
     「챗GPT 출시」를 `chatgpt`로 치면 0건이었다 — AI 열은 영어가 모국어인 열이고
     제품 이름이 거기서 나온다. 실측: 4,139항목 · raw 68KB.
     ja·zh 별칭은 넣지 않았다(색인이 두 배가 되고, 지금 지은 이름은 한국어뿐이다).
*/
const searchItems = [];
for (const r of all) {
  const name = nameOf(r) ?? r.names_native?.[REGION_LANG[r.region]] ?? null;
  if (!name) continue;
  const en = r.names_native?.en;
  const item = [name, r.date.year, r.region, eventId(r).replace(/^ev_/, ""), r.importance_auto ?? 2];
  if (en && en !== name) item.push(en);
  searchItems.push(item);
}
searchItems.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || a[1] - b[1]);
write("search.json", { version: "v1", items: searchItems });

/*
  **manifest는 작아야 한다.** 그리드가 첫 로드에 `cache: "no-cache"`로 받아 **매번 재검증**하는
  파일이고(발행 버전을 알아야 나머지 URL에 ?v=를 붙일 수 있다), 읽는 값은 셋뿐이다 —
  `stage` · `counts.events` · `publishedAt`.

  한때 파일 무결성 색인(`chunks`: 경로 → sha256)이 여기 같이 들어 있었다. 항목 13,217개 중
  11,365개가 `events/detail/*.json`이라 **1,321KB(gzip 574KB)**였고, 그것을 첫 화면마다 받아
  세 값을 읽고 버렸다. 읽는 코드는 레포 어디에도 없었다(TimelineGrid의 `chunks`는 이름만 같은
  로컬 useRef 캐시다). 2026-09-20 실측으로 찾아 `chunks.json`으로 뺐다.

  무결성 색인은 여전히 발행한다 — 지운 것이 아니라 **첫 화면의 길에서 치운 것**이다.
*/
write("chunks.json", { version: "v1", chunks });
write("manifest.json", { version: "v1", stage, publishedAt: new Date().toISOString(), counts });

console.log(`발행 — stage=${stage} → ${OUT}
  사건        ${all.length}  (${Object.entries(counts.byRegion).map(([k, v]) => `${k} ${v}`).join(" · ")})
  제외        rejected ${skipped.rejected} · period ${skipped.period}
  겹침 합침   ${mergedRows}행 (같은 열·같은 해·같은 제목 — 원문은 대표의 alt로) · 중요도 승계 ${liftedRows}건 · QID 승계 ${qidInherited}건 · 이름이 맞는 쪽으로 교체 ${qidSwitched}건 (그 밖에 서로 다른 QID ${qidConflicts}건은 그대로)
  나라의 시작 ${foundingRows}건 (정치체마다 한 줄, 그 해의 맨 앞)
  교차 사건   ${Object.keys(crossGroups).length}묶음 ${Object.values(crossGroups).reduce((a, g) => a + g.length, 0)}행 (같은 사건을 여러 열이 각자 적은 것) · QID 교정 ${qidFixed}건${qidFixStale.length ? ` — 맞지 않아 건너뜀 ${qidFixStale.join(", ")}` : ""}
  검색 색인   ${searchItems.length}건 (이름이 있는 것만 · 첫 화면에서는 받지 않는다)
  연도 색인   ${Object.values(yearsByRegion).reduce((a, d) => a + d.length, 0)}개 해 (빈 구간 힌트용)
  청크 수록   century ${byLevel.century} · decade ${byLevel.decade} · year ${byLevel.year}
  기간        막대 ${spanKept}건 (중복 제거 ${spanDupes})
  공식 출처   매칭 사건 ${officialMatched} · 연도 파일 ${officialYears} (항목 ${officialEntries})
  파일        ${Object.keys(chunks).length}`);
