/**
 * 수집기 — data-model §4-2 [수집] + [정규화] 앞부분.
 *
 * 연표 문서를 받아 후보 행을 뽑고, 본문 링크에 Wikidata QID를 붙여
 * `curation/raw/{region}/{slug}.jsonl`에 쓴다(§4-5).
 *
 * 이 단계에서 재는 것은 건수가 아니라 **깔때기**다.
 *   후보 행 → 연도 파싱 성공 → 본문 링크 보유 → QID 부착 성공
 * 링크 보유율이 낮은 원천(ko:한국사 연표 38%)이 실제로 산문을 센 것인지,
 * 아니면 연표 항목인데 링크만 없는 것인지가 여기서 드러난다(PRD §11 C-12).
 *
 * 사용: node tools/collect.mjs kr
 *       node tools/collect.mjs kr --limit 50
 *       MVMT_CONTACT=you@example.com node tools/collect.mjs kr
 */

import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

import { parseYear } from "./parse-year.mjs";

/**
 * 후보 행의 안정 id. 재수집해도 원문·리비전이 같으면 같은 값이다.
 * 행 번호(index)는 재수집마다 바뀌므로 다른 파일이 참조하면 안 된다 —
 * 파일럿 초안이 source_row로 참조했다가 이 문제를 겪었다.
 */
export const rowId = (url, revid, text) =>
  createHash("sha1").update(`${url}|${revid}|${text}`).digest("hex").slice(0, 12);

const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-collector/0.1 (research; ${CONTACT})`;

/** 수집 대상. data-model §4-1. */
const SOURCES = {
  kr: [
    { wiki: "ko", title: "한국사 연표", slug: "ko-korean-timeline" },
    { wiki: "en", title: "Timeline of Korean history", slug: "en-korean-timeline" },
    { wiki: "en", title: "Timeline of the Kwangmu Reform", slug: "en-kwangmu" }, // 대한제국 1897~1907
  ],
  cn: [
    { wiki: "zh", title: "中国历史年表", slug: "zh-chinese-timeline" },
    { wiki: "en", title: "Timeline of Chinese history", slug: "en-chinese-timeline" },
    // 왕조별 연표(2026-09-05). 전근대가 왕조 문서에만 촘촘하다 — 한 문서로는 한 왕조가 몇 줄에 그친다
    ...["Han", "Tang", "Song", "Ming", "Qing"].map((d) => ({ wiki: "en", title: `Timeline of the ${d} dynasty`, slug: `en-cn-${d.toLowerCase()}` })),
    { wiki: "zh", title: "中华人民共和国历史年表", slug: "zh-prc-timeline" }, // 1949~
  ],
  jp: [
    { wiki: "ja", title: "日本史の出来事一覧", slug: "ja-japanese-timeline" },
    { wiki: "en", title: "Timeline of Japanese history", slug: "en-japanese-timeline" },
  ],
  /*
    AI 열 — 유일한 비지리적 열(대표 아이디어 2026-09-20, "데이터부터 만들고 보고 결정").
    ko.wikipedia 「인공지능의 역사」는 연표가 아니라 **산문**이라 이 수집기가 쓸 수 없다.
    구조화된 원천은 en 문서 하나뿐이고, 그래서 이 열은 100% 영문 원문 → 기계 번역 +
    지은 제목에 의존한다. 대신 그 문서는 **고대부터** 다룬다(탈로스·알자자리 오토마타·
    파스칼린·배비지 해석기관) — 1900년 이전에도 35~40건이라 빈 열이 되지 않는다.
  */
  ai: [
    { wiki: "en", title: "Timeline of artificial intelligence", slug: "en-ai-timeline" },
  ],
  us: [
    { wiki: "en", title: "Timeline of pre–United States history", slug: "en-us-pre" },
    /*
      **1760~1789가 통째로 비어 있었다.** 아래 연대별 문서가 1790년부터 시작해서, 미국 열에
      1776년 독립선언도 1787년 헌법도 **행 자체가 없었다**(2026-09-21 실측: 그 구간은 전부 전투였다.
      전투는 위키데이터 쪽에서 왔다). 대표가 "국가 설립이 왜 안 나오냐"고 물었을 때
      한국·중국은 순위 문제였지만 미국은 데이터가 없는 문제였다.

      「Timeline of United States history (1760–1789)」는 이 문서로 넘겨준다.
      연도가 **절 제목**에 있고 줄에는 `(July 4)`처럼 날짜만 끝에 붙는 꼴이라 `mode`가 필요하다.
    */
    { wiki: "en", title: "Timeline of the American Revolution", slug: "en-us-revolution", mode: "headingList" },
    ...["1790–1819", "1820–1859", "1860–1899", "1900–1929", "1930–1949",
        "1950–1969", "1970–1989", "1990–2009", "2010–present"].map((p) => ({
      wiki: "en",
      title: `Timeline of the history of the United States (${p})`,
      slug: `en-us-${p.replace(/[^0-9a-z]+/gi, "-")}`,
    })),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 네트워크
// ─────────────────────────────────────────────────────────────────────────────

async function api(host, params, tries = 4) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1500 * 2 ** i;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }
  throw new Error(`429 반복 — ${url}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 추출
// ─────────────────────────────────────────────────────────────────────────────

const strip = (html) =>
  html
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();

const SKIP_NS = /^(파일|File|Help|도움말|Special|특수|Category|분류|Portal|위키백과|Wikipedia|Template|틀):/;

/** 본문 위키 링크의 문서 제목들. 네임스페이스·앵커·중복 제거. */
/**
 * 연도·연대·날짜 문서로 가는 링크. 첫 링크가 QID가 되는데(main), ja·zh 연표는 항목마다
 * "743年"·"前202年"을 링크하므로 이걸 두면 사건의 QID가 연도 문서(언어판 200개)가 되어
 * 중요도 5를 받고 관점 명칭이 "743년"이 된다(2026-09-05 jp·cn 재수집에서 확인).
 */
const YEARISH_TITLE =
  /^(?:紀元前|前|公元前|西元前|기원전\s*)?\d{1,4}\s*(?:年代?|년대?|s)?$|^\d{1,4}\s*(?:BCE?|CE|AD)$|^AD\s*\d{1,4}$|^\d{1,2}月\d{1,2}日$|^\d{1,2}월\s*\d{1,2}일$|^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$|^\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)$/;
/** ja 연표의 원호 괄호 "（元和元年）" — 안의 링크는 원호 문서라 사건이 아니다. */
const ERA_PAREN = /（(?:<[^>]+>|[^（）])*?年）/g;

function bodyLinks(html) {
  const out = new Set();
  for (const m of html.replace(ERA_PAREN, "").matchAll(/<a[^>]+href="\/wiki\/([^"#]+)(?:#[^"]*)?"/g)) {
    const title = decodeURIComponent(m[1]).replace(/_/g, " ");
    if (!SKIP_NS.test(title) && !YEARISH_TITLE.test(title)) out.add(title);
  }
  return [...out];
}

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

/**
 * "21 October" 처럼 **연 안의 날짜**인가.
 *
 * en 연표는 연도를 부모 항목에 두고 자식에 날짜만 적는다
 * (1994 → "21 October. The Seongsu Bridge disaster…"). 이걸 연도로 읽으면
 * 성수대교 붕괴가 서기 21년 사건이 된다. 2026-09-04 수집에서 70건이 이렇게
 * 어긋났다.
 */
const isDayMonth = (text) =>
  // 날짜 범위도 날짜다 — "3 to 11 May — Jinan incident."가 서기 3년이 되고, 뒤따르는 줄들이 그 해를
  // 물려받아 "Battle of Midway"가 서기 4년에 놓였다(2026-09-05)
  new RegExp(`^\\d{1,2}(st|nd|rd|th)?(\\s*(?:to|and|&|,|–|—|-)\\s*\\d{1,2}(st|nd|rd|th)?)*\\s+(${MONTHS})\\b`, "i").test(text.trim()) ||
  new RegExp(`^(${MONTHS})\\s+\\d{1,2}\\b`, "i").test(text.trim()) ||
  /^\d{1,2}\s*(월|月)/.test(text.trim());

/** 사건이 아니라 시대 구분으로 보이는가(editorial-policy §3-6 → polities). */
const looksLikePeriod = (text) =>
  text.length <= 24 && /(시대|시기|時代|时代|時期|时期|Period|Age|Era)\s*$/i.test(text.trim());

/**
 * 연도 표기의 시작 위치. 접두(기원전·BC.)를 포함해 잡는다 — 접두를 빼고 자르면
 * "BC.238년경"이 "238년경"이 되어 기원전 표시를 잃는다(파일럿 #8).
 */
// 한자권 표기(年·世紀)는 한자·가나·여는 괄호 뒤에서는 연도 표기로 보지 않는다 — ja 목록의
// "1633年（寛永10年）"에서 원호 연수 "10年"에 걸려 잘리면 안 된다. "1960年代"도 연도가 아니다.
const YEAR_MARK =
  /(?<![\d~–-])(?:기원전\s*|BC\.?\s*)?\d{1,4}\s*(?:년(?![\d대])|세기)|(?<![\d~–\-\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}（(])(?:紀元前|公元前|西元前|前)?\d{1,4}\s*(?:年(?!代)|世紀|世纪)/gu;

/** 문장 어디에 있든 첫 연도 표기를 읽는다. 표 행 머리가 본문과 무관할 때의 대안. */
function firstYearIn(text) {
  const m = text.match(YEAR_MARK);
  if (!m) return null;
  const idx = text.indexOf(m[0]);
  return parseYear(text.slice(idx));
}

/** 한 칸에 여러 해가 뭉쳐 있으면 연도 경계로 쪼갠다. */
function splitByYear(text) {
  const marks = [...text.matchAll(YEAR_MARK)];
  if (marks.length < 2) return [text];
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const seg = text.slice(start, end).trim().replace(/[,·]$/, "");
    if (seg.length >= 6) out.push(seg);
  }
  return out.length ? out : [text];
}

const LI_RE = /<li\b[^>]*>([\s\S]*?)(?=<li\b|<\/ul>|<\/ol>)/g;
const TABLE_RE = /<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g;

/**
 * 조각 안의 <li>들을 후보 항목으로 뽑는다. 문서 순서대로 훑으며 마지막으로 본
 * 연도를 물려준다(en 연표: "1994" 부모 → "21 October. …" 자식).
 * 표 셀 안의 목록과 본문 목록이 같은 함수를 쓴다 — 두 번 세지 않으려면
 * 호출하는 쪽에서 어느 HTML을 넘길지만 가르면 된다.
 * @returns 이어서 쓸 carriedYear
 */
function scanListItems(fragment, items, shape, carriedYear) {
  for (const m of fragment.matchAll(LI_RE)) {
    const li = m[0];
    const text = strip(li);
    if (!text) continue;

    const own = isDayMonth(text) ? null : parseYear(text);
    if (own) carriedYear = own;
    const date = own ?? (isDayMonth(text) ? carriedYear : null);
    if (!date) continue;
    if (text.length < 12) continue; // "1760–1789" 같은 시기 내비게이션

    for (const seg of splitByYear(text)) {
      items.push({
        shape,
        yearText: seg.slice(0, 24),
        text: seg,
        links: bodyLinks(li),
        date: (isDayMonth(seg) ? null : parseYear(seg)) ?? date,
        kind: looksLikePeriod(seg) ? "period?" : "event",
      });
    }
  }
  return carriedYear;
}

/** 절 제목. `<h2 …>1776</h2>` · `<h3>1776</h3>` — 안쪽 `<span>`까지 벗겨서 본다. */
const HEADING_RE = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/g;

/**
 * **연도가 절 제목에 있는 문서.** 목록 줄에는 날짜가 `(July 4)`처럼 **끝에 괄호로** 붙고
 * 연도는 아예 없다 — 그 해 절 안에 있으니 적을 이유가 없기 때문이다.
 *
 * 기본 `extract`는 줄 안에서 연도를 찾으므로 이런 문서에서 **아무것도 못 건진다.**
 * 실제로 미국 열이 그 모양으로 비어 있었다: 원천이 「pre–United States history」 다음
 * 바로 「1790–1819」로 건너뛰어 **1760~1789가 통째로 없었고**, 그래서 1776년 독립선언도
 * 1787년 헌법도 데이터에 존재하지 않았다(2026-09-21 실측 — 그 구간은 전부 전투였다).
 *
 * 이 모드는 **원천마다 켠다**(`mode: "headingList"`). 모든 문서에 적용하면 연도 없는 줄이
 * 앞 절의 해로 쏟아져 들어온다 — 기존 열의 수집 결과를 건드리지 않으려는 것이다.
 */
function extractHeadingList(html) {
  const items = [];
  // 제목 위치로 잘라 각 절의 몸통을 얻는다
  const heads = [...html.matchAll(HEADING_RE)].map((m) => ({ at: m.index ?? 0, len: m[0].length, text: strip(m[1]) }));
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    // 제목이 연도(또는 연도로 시작)일 때만. 「Aftermath」 같은 절은 건너뛴다
    const year = /^-?\d{3,4}\b/.test(h.text) ? parseYear(h.text) : null;
    if (!year) continue;
    const body = html.slice(h.at + h.len, heads[i + 1]?.at ?? html.length);
    for (const m of body.matchAll(LI_RE)) {
      const li = m[0];
      const text = strip(li);
      if (!text || text.length < 12) continue;
      // 줄이 자기 연도를 말하면 그것을 믿는다. 아니면 절의 해다.
      const own = isDayMonth(text) ? null : parseYear(text);
      items.push({
        shape: "list",
        yearText: h.text.slice(0, 24),
        text,
        links: bodyLinks(li),
        date: own ?? year,
        kind: looksLikePeriod(text) ? "period?" : "event",
      });
    }
  }
  return items;
}

/**
 * 문서 HTML → 후보 항목. 표와 목록을 모두 본다.
 *
 * 표 행은 두 모양이다(ko:한국사 연표, 2026-09-05 확인).
 *   ① [연도 | 본문] — 머리 연도 + 본문. 본문에 여러 해가 뭉쳐 있으면 쪼갠다.
 *   ② [<ul><li>…</li></ul>] 한 칸 — 근현대 구간. 머리 연도가 없고 항목마다 연도가 있다.
 * ②를 "셀 2개 미만"으로 건너뛰고 표 안 목록을 본문 목록 분기에서도 제외하면
 * 근현대가 통째로 사라진다(1945년 이후 360 → 205건으로 줄었던 원인).
 */
function extract(html, mode) {
  // 연도가 절 제목에 있는 문서는 다른 길로 간다(위)
  if (mode === "headingList") return extractHeadingList(html);
  const items = [];

  for (const table of html.match(TABLE_RE) ?? []) {
    let carried = null;
    // rowspan으로 합쳐진 연도 셀: 두 번째 행부터는 사건 셀 하나뿐이다. 직전 행의 머리
    // 연도를 물려주지 않으면 그 행들이 전부 버려진다 — en:Timeline of Japanese history가
    // 545행 중 335행만 남았던 원인(2026-09-05). 중국 연표도 같은 구조다.
    let carriedHead = null;
    for (const tr of table.split(/<tr[^>]*>/).slice(1)) {
      const cells = tr.split(/<t[dh][^>]*>/).slice(1);
      if (cells.length === 0) continue;
      const first = strip(cells[0] ?? "");
      const headDate = cells.length >= 2 && !isDayMonth(first) ? parseYear(first) : null;

      if (!headDate) {
        // ② 머리 연도 없음 — 셀 안의 목록 항목을 각각 읽는다
        if (/<li\b/.test(tr)) {
          carried = scanListItems(tr, items, "table", carried);
          continue;
        }
        // 목록도 없으면 셀 전체를 본문으로 보고 연도 표기로 쪼갠다
        const body = cells.map(strip).filter(Boolean).join(" — ");
        for (const seg of splitByYear(body)) {
          // 셀에 연도가 없으면 rowspan으로 합쳐진 직전 머리 연도를 쓴다
          const date = (isDayMonth(seg) ? null : parseYear(seg)) ?? firstYearIn(seg) ?? carriedHead;
          if (!date || seg.length < 12) continue;
          items.push({ shape: "table", yearText: seg.slice(0, 24), text: seg, links: bodyLinks(tr), date, kind: looksLikePeriod(seg) ? "period?" : "event" });
        }
        continue;
      }

      carriedHead = headDate; // 다음 행이 rowspan 이어짐이면 이 연도를 물려받는다
      // ① 머리 연도 + 본문. 행 머리 연도는 마지막 대안이다 — 시대 행은 머리가 "250"인데
      // 본문은 BC 4세기·BC 238이었다(파일럿 #8). 본문에 연도가 있으면 그것을 믿는다.
      const body = cells.slice(1).map(strip).filter(Boolean).join(" — ");
      const links = bodyLinks(tr);
      for (const seg of splitByYear(body)) {
        const date = (isDayMonth(seg) ? null : parseYear(seg)) ?? firstYearIn(seg) ?? headDate;
        items.push({
          shape: "table",
          yearText: seg === body ? first : seg.slice(0, 24),
          text: seg,
          links,
          date,
          kind: looksLikePeriod(seg) ? "period?" : "event",
        });
      }
    }
  }

  // 표 밖의 목록만 — 표 안 목록은 위에서 이미 읽었다(같은 사건을 두 번 세지 않는다)
  scanListItems(html.replace(TABLE_RE, ""), items, "list", null);
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// QID 부착 (data-model §4-2 [정규화])
// ─────────────────────────────────────────────────────────────────────────────

/** 문서 제목 → QID. 50개씩 묶어 조회한다. */
async function attachQids(wiki, titles) {
  const map = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api("www.wikidata.org", {
      action: "wbgetentities",
      sites: `${wiki}wiki`,
      titles: batch.join("|"),
      props: "sitelinks",
      sitefilter: "kowiki|enwiki|jawiki|zhwiki",
    });
    for (const [qid, ent] of Object.entries(j.entities ?? {})) {
      if (qid.startsWith("-")) continue; // 매칭 실패 항목
      const sl = ent.sitelinks ?? {};
      const source = sl[`${wiki}wiki`]?.title;
      if (!source) continue;
      map.set(source, {
        qid,
        // 관점 명칭의 원문이 곧 사이트링크 표제어다(editorial-policy §3-1)
        sitelinks: Object.fromEntries(
          ["kowiki", "enwiki", "jawiki", "zhwiki"].filter((k) => sl[k]).map((k) => [k.replace("wiki", ""), sl[k].title]),
        ),
      });
    }
    await sleep(600);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const region = process.argv[2];
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
  const sources = SOURCES[region];
  if (!sources) {
    console.error(`사용: node tools/collect.mjs <${Object.keys(SOURCES).join("|")}> [--limit N]`);
    process.exit(1);
  }
  if (CONTACT === "contact-not-set") {
    console.warn("⚠ MVMT_CONTACT 미설정 — 위키미디어 예절상 채우는 게 맞다.\n");
  }

  const accessedAt = new Date().toISOString();
  const funnel = { candidates: 0, withLink: 0, withQid: 0, byShape: { table: 0, list: 0 }, periodish: 0 };
  const all = [];

  for (const src of sources) {
    process.stderr.write(`${src.wiki}:${src.title} … `);
    const host = `${src.wiki}.wikipedia.org`;
    const j = await api(host, {
      action: "parse",
      page: src.title,
      prop: "text|revid",
      redirects: "1",
    });
    if (j.error) {
      process.stderr.write(`실패 ${j.error.code}\n`);
      continue;
    }
    const { text: html, revid, title: resolved } = j.parse;
    const items = extract(html, src.mode);

    const titles = [...new Set(items.flatMap((it) => it.links))];
    const qidMap = await attachQids(src.wiki, titles);

    for (const it of items) {
      funnel.candidates++;
      funnel.byShape[it.shape]++;
      if (it.kind === "period?") funnel.periodish++;
      if (it.links.length) funnel.withLink++;
      // 그 행의 링크 중 QID가 붙은 첫 번째를 사건의 QID 후보로 본다
      const hit = it.links.map((t) => qidMap.get(t)).find(Boolean);
      if (hit) funnel.withQid++;
      all.push({
        id: rowId(`https://${host}/wiki/${encodeURIComponent(resolved)}`, revid, it.text),
        status: "draft",
        region,
        kind: it.kind,
        shape: it.shape,
        yearText: it.yearText,
        text: it.text,
        date: it.date,
        qid: hit?.qid ?? null,
        names_native: hit?.sitelinks ?? null,
        links: it.links,
        source: {
          url: `https://${host}/wiki/${encodeURIComponent(resolved)}`,
          revid,
          accessedAt,
          license: "CC BY-SA 4.0",
        },
      });
    }
    process.stderr.write(`후보 ${items.length} · 링크 대상 ${titles.length} · QID ${qidMap.size}\n`);
    await sleep(900);
  }

  const rows = all.slice(0, limit);
  const dir = `curation/raw/${region}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/candidates.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const p = (a) => (funnel.candidates ? `${((a / funnel.candidates) * 100).toFixed(0)}%` : "—");
  console.log(`
깔때기 — ${region}
  후보 행        ${funnel.candidates}  (표 ${funnel.byShape.table} · 목록 ${funnel.byShape.list})
  시대 구분 의심  ${funnel.periodish}  ${p(funnel.periodish)}  ← polities로 보낼 후보(editorial-policy §3-6)
  본문 링크 보유  ${funnel.withLink}  ${p(funnel.withLink)}
  QID 부착 성공   ${funnel.withQid}  ${p(funnel.withQid)}

기록: ${dir}/candidates.jsonl  (${rows.length}줄${rows.length < all.length ? `, 전체 ${all.length}에서 --limit` : ""})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
