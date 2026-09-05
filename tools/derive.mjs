/**
 * 파생 — data-model §4-2 [파생]. LLM 없이 수집 원문에서 사건 레코드를 만든다(2026-09-05 A-15).
 *
 *   curation/raw/{region}/candidates.jsonl   (tools/collect.mjs)
 *   curation/raw/_qid-sitelinks.json         (tools/enrich.mjs — 중요도 프록시)
 *   curation/raw/nikh/timeline.jsonl         (tools/fetch-nikh.mjs — 한국 열만)
 *     → curation/events/{region}.jsonl       (발행 원본, git 추적)
 *
 * 규칙 (editorial-policy §1-6·§1-7):
 *   text            원문 줄 그대로. 우리가 쓴 문장은 없다
 *   title           원문에서 연도 표기를 뗀 것(칩 라벨). 사이트링크 표제어는 쓰지 않는다 —
 *                   링크가 인물·지명일 때가 많아 사건 제목이 못 된다
 *   names_native    QID의 사이트링크 원문(관점별 명칭). 링크 앵커가 그 줄에 실제로 있을 때만 —
 *                   ko 표 행은 셀 전체의 첫 링크가 붙어 와서 엉뚱한 QID가 많다
 *   importance_auto 언어판 수 → 1~5 (아래 IMPORTANCE). QID 없으면 2
 *   historicity     전승 연대는 열별 문턱(§4-3): 한국 BC 1000 이전, 중국 BC 1600 이전(상 이전), 일본 BC 300 이전
 *   status          published가 기본. 시대 구분·제목만 있는 줄·연도 범위 머리글은 rejected(사유 기록)
 *   [한국]          국사편찬위 연표와 매칭(src/lib/curation/nikh-match.mjs) → sources 앞에 공식 항목
 *
 * 사용:  node tools/derive.mjs [kr cn jp us]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bestMatches, stripYear } from "../src/lib/curation/nikh-match.mjs";

const REGIONS = process.argv.slice(2).filter((a) => /^[a-z]{2}$/.test(a));
const regions = REGIONS.length ? REGIONS : ["kr", "cn", "jp", "us"];

/**
 * 언어판 수 → 중요도. **열 안에서의 상대 순위**다(§4-3).
 * 절대 문턱을 쓰면 한국 열의 세기 레벨이 빈다 — ko 「한국사 연표」 표 행은 셀 단위 링크라
 * 유효 QID가 227/939뿐이고, 미국 열은 en 목록 행마다 링크가 있어 971/1,520이다. 원천의
 * 링크 밀도 차이지 사건의 무게 차이가 아니므로 열마다 같은 비율로 자른다.
 *   5: 상위 8%(세기 레벨)  4: 다음 17%(십년 레벨)  3: 다음 25%  2: 나머지·QID 없음  1: 언어판 2개 이하
 * 언어판 수 분포(2026-09-05, n=2,742): p50 25 · p75 53 · p90 95 · p97 187.
 */
const SHARES = [[5, 0.08], [4, 0.17], [3, 0.25]];
function assignImportance(recs) {
  const ranked = recs.filter((r) => r.sitelinks > 2).sort((a, b) => b.sitelinks - a.sitelinks);
  let i = 0;
  for (const [imp, share] of SHARES) {
    const end = Math.min(ranked.length, i + Math.ceil(recs.length * share));
    for (; i < end; i++) ranked[i].importance_auto = imp;
  }
  for (const r of recs) r.importance_auto ??= r.sitelinks != null && r.sitelinks <= 2 ? 1 : 2;
}

const TRADITIONAL_BEFORE = { kr: -1000, cn: -1600, jp: -300 };
const historicityOf = (region, year) => (year < (TRADITIONAL_BEFORE[region] ?? -Infinity) ? "traditional" : "historical");

const LICENSE_WIKI = "CC BY-SA 4.0";
const LICENSE_NIKH = "KOGL 제1유형(이용허락범위 제한 없음)";
/** 열의 자국어판. 같은 사건이 두 언어판에 있으면 이쪽 줄이 대표가 된다. */
const REGION_LANG = { kr: "ko", cn: "zh", jp: "ja", us: "en" };

/**
 * 같은 열·같은 해·같은 QID(링크 앵커가 줄에 있는 유효 QID)면 같은 사건이다(data-model §4-2 [정규화]).
 * 자국어판 줄을 대표로 두고, 다른 언어판 줄은 status=merged로 접되 그 원문·출처는 대표의
 * sources에 남긴다 — 상세 패널이 "다른 언어판 연표 원문"으로 보여 준다. QID가 없는 줄은
 * 합치지 않는다(인물 QID가 서로 다른 사건에 붙는 문제, §5-1).
 */
function mergeDuplicates(recs, region) {
  const groups = new Map();
  for (const r of recs) {
    if (r.status !== "published" || !r.qid) continue;
    const k = `${r.date.year}|${r.qid}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(r);
  }
  let merged = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => (a.lang === REGION_LANG[region] ? 0 : 1) - (b.lang === REGION_LANG[region] ? 0 : 1) || b.text.length - a.text.length);
    const [primary, ...rest] = g;
    for (const r of rest) {
      // 같은 언어판 안의 두 줄은 다른 사건이다 — ja "7月 ポツダム宣言発表"와 "8月14日 ポツダム宣言受諾"이
      // 같은 QID(선언 문서)를 갖는다. 언어판을 건너는 중복만 합친다
      if (r.lang === primary.lang) continue;
      for (const s of r.sources) {
        if (s.kind === "wikipedia") primary.sources.push({ ...s, lang: r.lang, text: r.text, alt: true });
        else if (!primary.sources.some((p) => p.kind === s.kind && p.id === s.id)) primary.sources.push(s);
      }
      r.status = "merged";
      r.merged_into = primary.source_id;
      merged++;
    }
  }
  return merged;
}

/** 열의 수록 시작 연도(PRD §11 C-3). 미국 열은 1607 제임스타운부터 — pre-US 연표의 그 이전 행은 싣지 않는다. */
const COVERAGE_FROM = { us: 1607 };

/** 사건이 아닌 줄 — 연도 범위 머리글("2010–present"), 날짜만("September 11"), 글자 없는 줄, 수록 범위 밖. */
function rejectReason(raw, title) {
  if (raw.kind !== "event") return "시대 구분(kind=period) — 정치체 밴드로";
  if (raw.date.year < (COVERAGE_FROM[raw.region] ?? -Infinity)) return `수록 범위 밖(${COVERAGE_FROM[raw.region]}년 이전, C-3)`;
  const t = title.replace(/[–—-]/g, "-").trim();
  if (/^-?\s*(present|현재)\.?$/i.test(t) || /^\d{3,4}\s*-\s*(present|\d{3,4})\.?$/i.test(t)) return "연도 범위 머리글";
  const letters = t.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, "").replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return "본문 없음(날짜·숫자뿐)";
  return null;
}

// ── 입력 ────────────────────────────────────────────────────────────────────
const sitelinks = existsSync("curation/raw/_qid-sitelinks.json") ? JSON.parse(readFileSync("curation/raw/_qid-sitelinks.json", "utf8")).counts : {};
if (!Object.keys(sitelinks).length) console.warn("⚠ _qid-sitelinks.json 없음 — 중요도가 전부 2가 된다. tools/enrich.mjs를 먼저 돌려라.");

let nikhByYear = null;
if (regions.includes("kr")) {
  const f = "curation/raw/nikh/timeline.jsonl";
  if (!existsSync(f)) console.warn("⚠ 국사편찬위 연표 없음 — 한국 열이 위키 출처만 갖는다. tools/fetch-nikh.mjs를 먼저 돌려라.");
  else {
    nikhByYear = new Map();
    for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
      const n = JSON.parse(line);
      (nikhByYear.get(n.date.y) ?? nikhByYear.set(n.date.y, []).get(n.date.y)).push(n);
    }
  }
}
/** 같은 해 + 전해 음력 11·12월(양력으로 넘어오는 달). */
const nikhCandidates = (y) => [...(nikhByYear.get(y) ?? []), ...(nikhByYear.get(y - 1) ?? []).filter((n) => n.date.cal === "lunar" && n.date.m >= 11)];

// ── 파생 ────────────────────────────────────────────────────────────────────
mkdirSync("curation/events", { recursive: true });
for (const region of regions) {
  const src = path.join("curation/raw", region, "candidates.jsonl");
  if (!existsSync(src)) { console.warn(`${region}: ${src} 없음`); continue; }
  const raws = readFileSync(src, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const out = [];
  const stat = { published: 0, rejected: {}, qid: 0, matched: 0, official: 0, byImp: {} };

  for (const raw of raws) {
    const lang = /https:\/\/([a-z]+)\.wikipedia/.exec(raw.source.url)?.[1] ?? "en";
    const title = stripYear(raw.text);
    const reason = rejectReason(raw, title);

    // QID는 링크 앵커(그 언어판 표제어)가 이 줄에 실제로 있을 때만 이 사건의 것이다
    const anchor = raw.names_native?.[lang];
    const qidValid = Boolean(raw.qid && anchor && raw.text.includes(anchor));
    const n = qidValid ? sitelinks[raw.qid] ?? null : null;

    const rec = {
      source_id: raw.id,
      status: reason ? "rejected" : "published",
      ...(reason ? { reject_reason: reason } : {}),
      region,
      kind: raw.kind === "event" ? "event" : "period",
      date: raw.date,
      historicity: historicityOf(region, raw.date.year),
      lang,
      title,
      text: raw.text,
      ...(qidValid ? { qid: raw.qid, names_native: raw.names_native, sitelinks: n } : {}),
      importance_auto: undefined, // 열 전체를 본 뒤 assignImportance가 채운다
      sources: [],
      derivedAt: new Date().toISOString(),
    };

    // [한국] 국사편찬위 매칭 — 맞으면 공식 항목이 앞에 선다
    if (nikhByYear && region === "kr" && !reason) {
      const koName = qidValid ? raw.names_native.ko ?? null : null;
      const matches = bestMatches({ text: raw.text, koName, split: lang === "ko" && raw.shape === "table" }, nikhCandidates(raw.date.year));
      for (const m of matches) {
        rec.sources.push({
          kind: "nikh", id: m.n.id, db: m.n.db, series: m.n.series, date: m.n.date, text: m.n.text, url: m.n.url,
          license: LICENSE_NIKH, match: { seg: m.seg, rank: Number(m.rank.toFixed(2)), why: m.why },
        });
      }
      if (matches.length) { stat.matched++; stat.official += matches.length; }
    }
    rec.sources.push({ kind: "wikipedia", url: raw.source.url, revid: raw.source.revid, accessedAt: raw.source.accessedAt, license: LICENSE_WIKI });

    out.push(rec);
    if (reason) stat.rejected[reason] = (stat.rejected[reason] ?? 0) + 1;
    else stat.published++;
    if (qidValid) stat.qid++;
  }

  stat.merged = mergeDuplicates(out, region);
  stat.published -= stat.merged;
  assignImportance(out.filter((r) => r.status === "published"));
  for (const r of out) { r.importance_auto ??= 2; if (r.status === "published") stat.byImp[r.importance_auto] = (stat.byImp[r.importance_auto] ?? 0) + 1; }

  const dst = path.join("curation/events", `${region}.jsonl`);
  writeFileSync(dst, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${region}: ${raws.length}행 → published ${stat.published} · merged ${stat.merged} · rejected ${Object.entries(stat.rejected).map(([k, v]) => `${k} ${v}`).join(", ") || 0}
    QID 유효 ${stat.qid} · 중요도 ${[5, 4, 3, 2, 1].map((i) => `${i}:${stat.byImp[i] ?? 0}`).join(" ")}${nikhByYear && region === "kr" ? `\n    국사편찬위 매칭 ${stat.matched}행 · 공식 항목 ${stat.official}건` : ""}`);
}
