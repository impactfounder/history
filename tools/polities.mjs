/**
 * 정치체 밴드 — data-model §2-2 polities, PRD §5-10 정치체 스티키 헤더.
 *
 * 어느 정치체·시대를 밴드로 둘지는 **사람이 고른다**(아래 BANDS — ko.wikipedia 표제어).
 * 시작·끝 연도는 Wikidata(CC0)에서 받는다: 시대는 P580/P582, 국가는 P571/P576.
 * 우리가 연도를 쓰지 않는 이유는 사건 본문과 같다 — 출처가 있는 값만 싣는다(editorial-policy §1-6).
 * Wikidata가 열 관점과 어긋나는 값(중화민국의 끝 — 본토 기준 1949)은 override에 사유와 함께 적는다.
 *
 * P0는 한 열·한 시점에 밴드 하나다(PRD §4-1 "병존 정치체는 한 줄 라벨"). 겹치면 앞 밴드의 끝을
 * 뒤 밴드의 시작으로 자른다 — 삼국(220~280)과 진(266~)이 겹치면 삼국 밴드는 266에서 끝난다.
 * 그 사실은 note에 남긴다.
 *
 * 출력: curation/polities/{region}.json (git 추적). 사용: node tools/polities.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";

const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-collector/0.1 (research; ${CONTACT})`;

/** 열별 밴드. `ko`는 ko.wikipedia 표제어(없으면 `en`). override는 Wikidata 값을 덮는 사람 판단. */
const BANDS = {
  kr: [
    { ko: "고조선", historicity: "traditional", note: "시작 BC 2333은 전승(editorial-policy §4-3). 축은 BC 500부터라 잘려 보인다" },
    { ko: "삼국 시대", note: "고구려·백제·신라(·가야) 병존 — P0는 한 줄 라벨" },
    { ko: "남북국 시대", note: "통일신라·발해" },
    { ko: "고려" },
    { ko: "조선" },
    { ko: "대한제국" },
    { ko: "일제강점기" },
    { ko: "대한민국" },
  ],
  cn: [
    { ko: "춘추 시대" },
    { ko: "전국 시대" },
    { ko: "진나라" },
    { ko: "한나라" },
    { ko: "삼국 시대 (중국)" },
    { en: "Jin dynasty (266–420)" },
    { ko: "남북조 시대" },
    { ko: "수나라" },
    { ko: "당나라" },
    { en: "Five Dynasties and Ten Kingdoms period" },
    { ko: "송나라" },
    { ko: "원나라" },
    { ko: "명나라" },
    { ko: "청나라" },
    { ko: "중화민국", override: { end_year: 1949 }, note: "중국 열에서는 본토 통치가 끝난 1949를 끝으로 본다. Wikidata는 진행 중(타이완)" },
    { ko: "중화인민공화국" },
  ],
  jp: [
    { ko: "조몬 시대" },
    { ko: "야요이 시대" },
    { ko: "고훈 시대" },
    { ko: "아스카 시대" },
    { ko: "나라 시대" },
    { ko: "헤이안 시대" },
    { ko: "가마쿠라 시대" },
    { ko: "무로마치 시대" },
    { ko: "아즈치모모야마 시대" },
    { ko: "에도 시대" },
    { ko: "메이지 시대" },
    { ko: "다이쇼 시대" },
    { ko: "쇼와 시대" },
    { ko: "헤이세이 시대" },
    { ko: "레이와 시대" },
  ],
  us: [
    { en: "Thirteen Colonies", note: "미국 열 수록 시작 1607(PRD §11 C-3)" },
    { ko: "미국", override: { start_year: 1776 }, note: "독립 선언 1776. Wikidata P571의 첫 값은 1784(파리 조약 발효)라 열 관점(건국 통념)으로 덮는다" },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wbget(site, titles) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: "wbgetentities", format: "json", formatversion: "2", sites: site, titles: titles.join("|"),
    props: "claims|sitelinks|labels", sitefilter: "kowiki|enwiki|jawiki|zhwiki", languages: "ko|en|ja|zh",
  })}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429) { await sleep(Number(res.headers.get("retry-after")) * 1000 || 3000 * 2 ** i); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("429 반복");
}

/** Wikidata 시간값 → {year, precision}. 연도 0이 없으므로 -0057 = BC 57 = 천문학적 -56. */
function timeOf(claims, props) {
  for (const p of props) {
    const list = (claims[p] ?? []).filter((c) => c.mainsnak?.datavalue);
    if (!list.length) continue;
    const c = list.find((x) => x.rank === "preferred") ?? list[0];
    const v = c.mainsnak.datavalue.value;
    const y = Number(/^([+-]\d+)/.exec(v.time)[1]);
    const prec = v.precision >= 9 ? "year" : v.precision === 8 ? "decade" : v.precision === 7 ? "century" : "millennium";
    return { year: y < 0 ? y + 1 : y, precision: prec, prop: p };
  }
  return null;
}

mkdirSync("curation/polities", { recursive: true });
for (const [region, bands] of Object.entries(BANDS)) {
  const byKo = bands.filter((b) => b.ko).map((b) => b.ko);
  const byEn = bands.filter((b) => b.en).map((b) => b.en);
  const ents = [];
  if (byKo.length) ents.push(...Object.values((await wbget("kowiki", byKo)).entities ?? {}));
  await sleep(1200);
  if (byEn.length) ents.push(...Object.values((await wbget("enwiki", byEn)).entities ?? {}));
  const find = (b) => ents.find((e) => (b.ko && e.sitelinks?.kowiki?.title === b.ko) || (b.en && e.sitelinks?.enwiki?.title === b.en));

  const out = [];
  for (const b of bands) {
    const e = find(b);
    if (!e || e.missing !== undefined) { console.warn(`${region}: 못 찾음 — ${b.ko ?? b.en}`); continue; }
    const start = timeOf(e.claims ?? {}, ["P580", "P571"]);
    const end = timeOf(e.claims ?? {}, ["P582", "P576"]);
    if (!start) { console.warn(`${region}: 시작 연도 없음 — ${b.ko ?? b.en} (${e.id})`); continue; }
    const sl = (w) => e.sitelinks?.[w]?.title ?? null;
    out.push({
      id: `${region}-${e.id.toLowerCase()}`,
      region,
      qid: e.id,
      name_ko: sl("kowiki") ?? e.labels?.ko?.value ?? b.en,
      names: { ko: sl("kowiki"), en: sl("enwiki"), ja: sl("jawiki"), zh: sl("zhwiki") },
      start_year: b.override?.start_year ?? start.year,
      end_year: b.override?.end_year ?? end?.year ?? null,
      start_precision: start.precision,
      end_precision: end?.precision ?? null,
      historicity: b.historicity ?? "historical",
      source: { wikidata: e.id, start: start.prop, end: end?.prop ?? null, ...(b.override ? { override: b.override } : {}) },
      ...(b.note ? { note: b.note } : {}),
    });
  }
  // 겹침 정리 — 시작 순으로 놓고 앞 밴드의 끝을 뒤 밴드의 시작으로 자른다
  out.sort((a, b) => a.start_year - b.start_year);
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (a.end_year == null || a.end_year > b.start_year) {
      a.note = [a.note, `끝 ${a.end_year ?? "진행 중"} → ${b.start_year}(다음 밴드 ${b.name_ko} 시작으로 자름)`].filter(Boolean).join(". ");
      a.end_year_wikidata = a.end_year;
      a.end_year = b.start_year;
    }
  }
  writeFileSync(`curation/polities/${region}.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${region} — ${out.length}개`);
  for (const p of out) console.log(`  ${p.qid.padEnd(9)} ${String(p.start_year).padStart(6)} ~ ${String(p.end_year ?? "").padEnd(5)} ${p.name_ko}${p.end_year_wikidata !== undefined ? ` (wd 끝 ${p.end_year_wikidata})` : ""}  en:${p.names.en}`);
  await sleep(300);
}
