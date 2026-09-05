/**
 * 위키데이터 사건 질의 — 연표 문서가 없는 구간을 채운다(대표 지시 2026-09-05 "더 찾아줘").
 *
 * 일본 열이 71%에서 멈춘 이유는 ja·en·zh 어디에도 추가 연표 문서가 없어서였다. 대신 위키데이터에는
 * **사건 자체가 항목으로** 있다 — 전투·조약·반란·지진·조약·선거… 나라(P17)와 날짜(P585/P580)를 달고.
 * 여기서 QID와 연도만 받아 오고, 이름(4개 언어)은 tools/enrich.mjs의 사이트링크가, 설명은
 * tools/summaries.mjs의 한국어 첫 문단이 채운다. 우리가 쓴 문장은 여전히 없다(editorial-policy §1-6).
 *
 * 유형은 화이트리스트다. 그냥 "P17=일본 + 날짜"로 받으면 임상시험 6,109·도로 3,495·스포츠 시즌
 * 2,543이 쏟아진다(2026-09-05 실측). 역사 사건 유형만 고른다.
 *
 * 출력: curation/raw/{region}/wikidata.jsonl  (gitignore — derive가 읽는다)
 * 사용:  node tools/wikidata-events.mjs [kr cn jp us]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-collector/0.1 (research; ${CONTACT})`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 역사 사건 유형(하위분류 한 단계까지). 스포츠 시즌·임상시험·도로를 걸러 내는 장치다. */
const TYPES = [
  "Q178561", // 전투
  "Q188055", // 공성전
  "Q198", // 전쟁
  "Q131569", // 조약
  "Q12890393", // 사태(incident)
  "Q124734", // 반란
  "Q10931", // 혁명
  "Q7944", // 지진
  "Q3199915", // 학살
  "Q45382", // 쿠데타
  "Q40231", // 선거
  "Q1656682", // 사건(event)
  "Q13418847", // 역사적 사건
  "Q350604", // 무력 충돌
  "Q168247", // 파업
  "Q2001676", // 시위
  "Q3839081", // 재해
  "Q8065", // 자연재해
  "Q1266946", // 화재
  "Q464980", // 원정
  "Q625298", // 평화 조약
  "Q1006311", // 폭동
  "Q180684", // 분쟁
  "Q3839081", // 재난
  "Q2223653", // 테러
  "Q18123741", // 감염병 유행
  "Q3241045", // 대량 학살
];

/** 열 → 그 열에 귀속되는 나라·정치체 QID(현대 + 역사 국가). P17이 현대 국가로 붙는 항목이 많다. */
const COUNTRIES = {
  kr: ["Q884", "Q423", "Q28233", "Q28179", "Q28208", "Q35216", "Q188212", "Q28193", "Q189061", "Q503585", "Q1179721", "Q18097"],
  cn: ["Q148", "Q8733", "Q9903", "Q7313", "Q7462", "Q9683", "Q7405", "Q7209", "Q7183", "Q13426199", "Q29520", "Q865"],
  jp: ["Q17", "Q188712"],
  us: ["Q30", "Q179997"],
};

/**
 * 재위 시작(즉위) — 열별 군주·수반 직위 QID(P39의 P580 한정어). 2026-09-05: 일본 3~5세기가 비었는데
 * 그 시대는 연표 문서도 위키데이터 사건도 없다. 대신 천황 계보에는 즉위 연도가 있다. 한국 열이
 * ko 연표에서 "신라 아달라 이사금 즉위"를 이미 얻는 것과 같은 것을 다른 열에도 준다.
 * 라벨은 인물 이름 + UI 언어의 "즉위"(구조 라벨이라 우리가 쓴 문장이 아니다 — role로 넘긴다).
 */
const REIGNS = {
  jp: ["Q208233", "Q131767"], // 천황, 쇼군
  cn: ["Q268218"], // 중국 황제
  kr: ["Q22304810", "Q12087706", "Q108544096"], // 조선 국왕, 고구려 왕, 조선 국왕(별 항목)
  us: [], // 대통령은 en 연표가 이미 선거·취임을 싣는다
};

/**
 * **유형 하나 × 나라 하나**씩 던진다. 2026-09-05 실측: 27종을 VALUES로 묶으면 59초(일본 한 구간),
 * 하위분류(P279?)까지 얹으면 60초 제한을 넘어 504다. 하나씩이면 0.4~1.5초로 끝난다.
 */

async function sparql(query, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`, {
      headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text).results.bindings;
    if (res.status === 429) { await sleep(Number(res.headers.get("retry-after")) * 1000 || 5000 * (i + 1)); continue; }
    if (res.status === 504) { await sleep(3000 * (i + 1)); continue; } // 시간 초과 — 다시
    throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  return null; // 이 구간은 건너뛴다
}

const regions = process.argv.slice(2).filter((a) => a in COUNTRIES);
for (const region of regions.length ? regions : Object.keys(COUNTRIES)) {
  const rows = new Map();
  let failed = 0, done = 0;
  const jobs = TYPES.flatMap((type) => COUNTRIES[region].map((country) => [type, country]));
  for (const [type, country] of jobs) {
    const q = `SELECT DISTINCT ?item ?d WHERE {
  ?item wdt:P31 wd:${type} ; wdt:P17 wd:${country} .
  { ?item wdt:P585 ?d } UNION { ?item wdt:P580 ?d }
}`;
    const res = await sparql(q);
    done++;
    if (!res) { failed++; continue; }
    for (const b of res) {
      const qid = b.item.value.split("/").pop();
      // SPARQL 결과의 날짜는 부호가 없다("1592-05-23T…"). 기원전만 "-"가 붙는다 — 부호를 필수로 두면 다 걸러진다
      const m = /^([+-]?\d+)-(\d\d)-(\d\d)/.exec(b.d.value);
      if (!m) continue;
      const y = Number(m[1]);
      const year = y < 0 ? y + 1 : y; // 천문학적 연수(1 BC = 0)
      if (year < -499 || year > 2025) continue; // 축 범위 밖(PRD §5-5A, C-2)
      const prev = rows.get(qid);
      if (!prev || year < prev.date.year) {
        rows.set(qid, {
          id: `wd_${qid.toLowerCase()}`,
          qid,
          region,
          date: { year, precision: "year", era: year <= 0 ? "bc" : "ad", ...(Number(m[2]) ? { month: Number(m[2]) } : {}), ...(Number(m[3]) ? { day: Number(m[3]) } : {}) },
          source: { kind: "wikidata", url: `https://www.wikidata.org/wiki/${qid}`, license: "CC0 1.0", accessedAt: new Date().toISOString() },
        });
      }
    }
    if (done % 20 === 0) console.log(`  ${region} ${done}/${jobs.length} · 누적 ${rows.size}`);
    await sleep(300);
  }

  // 재위 시작(즉위)
  for (const post of REIGNS[region] ?? []) {
    const res = await sparql(`SELECT DISTINCT ?item ?d WHERE {
  ?item p:P39 ?st . ?st ps:P39 wd:${post} ; pq:P580 ?d .
}`);
    if (!res) { failed++; continue; }
    let added = 0;
    for (const b of res) {
      const qid = b.item.value.split("/").pop();
      const m = /^([+-]?\d+)-(\d\d)-(\d\d)/.exec(b.d.value);
      if (!m) continue;
      const y = Number(m[1]);
      const year = y < 0 ? y + 1 : y;
      if (year < -499 || year > 2025) continue;
      const key = `${qid}@${year}`; // 한 인물이 두 번 즉위할 수 있다(중조·복위)
      if (rows.has(key)) continue;
      rows.set(key, {
        id: `wd_${qid.toLowerCase()}_${year}`,
        qid,
        region,
        role: "accession", // UI가 언어별 "즉위"를 붙인다
        date: { year, precision: "year", era: year <= 0 ? "bc" : "ad", ...(Number(m[2]) ? { month: Number(m[2]) } : {}), ...(Number(m[3]) ? { day: Number(m[3]) } : {}) },
        source: { kind: "wikidata", url: `https://www.wikidata.org/wiki/${qid}`, license: "CC0 1.0", accessedAt: new Date().toISOString() },
      });
      added++;
    }
    console.log(`  ${region} 재위 ${post}: ${added}건`);
    await sleep(500);
  }
  const dir = path.join("curation/raw", region);
  mkdirSync(dir, { recursive: true });
  const out = [...rows.values()].sort((a, b) => a.date.year - b.date.year);
  writeFileSync(path.join(dir, "wikidata.jsonl"), out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const decades = new Set(out.map((r) => Math.floor(r.date.year / 10)));
  console.log(`\n${region}: ${out.length}건 · 덮인 십년 ${decades.size}${failed ? ` · 실패 구간 ${failed}` : ""} → ${path.join(dir, "wikidata.jsonl")}`);
}

// 새 QID는 tools/enrich.mjs(사이트링크·유형)와 tools/summaries.mjs(설명)가 이어서 채운다
if (existsSync("curation/raw/_qid-sitelinks.json")) {
  const have = new Set(Object.keys(JSON.parse(readFileSync("curation/raw/_qid-sitelinks.json", "utf8")).counts));
  let need = 0;
  for (const region of Object.keys(COUNTRIES)) {
    const f = path.join("curation/raw", region, "wikidata.jsonl");
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) if (!have.has(JSON.parse(line).qid)) need++;
  }
  console.log(`\n다음: node tools/enrich.mjs (새 QID ${need}개) → node tools/summaries.mjs → node tools/derive.mjs`);
}
