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
  ],
  cn: [{ wiki: "en", title: "Timeline of Chinese history", slug: "en-chinese-timeline" }],
  jp: [{ wiki: "en", title: "Timeline of Japanese history", slug: "en-japanese-timeline" }],
  us: [
    { wiki: "en", title: "Timeline of pre–United States history", slug: "en-us-pre" },
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
function bodyLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/<a[^>]+href="\/wiki\/([^"#]+)(?:#[^"]*)?"/g)) {
    const title = decodeURIComponent(m[1]).replace(/_/g, " ");
    if (!SKIP_NS.test(title)) out.add(title);
  }
  return [...out];
}

/**
 * 연도 파싱. 천문학적 연수로 돌려준다(1 BC = 0, data-model §4-4).
 * 파싱 실패는 null — 오탐 판정의 1차 관문이다.
 */
function parseYear(text) {
  const t = text.replace(/,/g, "").trim();
  let m;
  // 세기 규칙이 먼저다 — 아래 BC 규칙이 "BC.4세기"의 "BC.4"를 연도 4로 먹어 버린다(파일럿 #8).
  // 세기: BC.4세기경 / 15세기 → 세기 중앙값, precision century. "BC 4세기"는 BC 400~301이므로 중앙 BC 350
  if ((m = t.match(/^(?:기원전|BC\.?)\s*(\d{1,2})\s*세기/i))) {
    const c = Number(m[1]);
    return { year: 1 - (c * 100 - 50), precision: "century", approximate: true, era: "bc" };
  }
  if ((m = t.match(/^(\d{1,2})\s*세기/))) {
    const c = Number(m[1]);
    return { year: (c - 1) * 100 + 50, precision: "century", approximate: true, era: "ad" };
  }
  // 한국어: BC.70만 / 기원전 500년 / 1592년
  if ((m = t.match(/^(?:기원전|BC\.?)\s*(\d+)\s*(만|천)?\s*년?/i))) {
    const mult = m[2] === "만" ? 10000 : m[2] === "천" ? 1000 : 1;
    return { year: 1 - Number(m[1]) * mult, precision: mult > 1 ? "millennium" : "year", era: "bc" };
  }
  if ((m = t.match(/^(\d{1,4})\s*년/))) return { year: Number(m[1]), precision: "year", era: "ad" };
  // 영어: 300 BC / 1592 / c. 1500 / 1860–1899
  if ((m = t.match(/^c\.?\s*(\d{1,7})\s*(BCE?)?/i))) {
    const y = Number(m[1]);
    return { year: m[2] ? 1 - y : y, precision: "year", approximate: true, era: m[2] ? "bc" : "ad" };
  }
  if ((m = t.match(/^(\d{1,7})\s*(BCE?|CE|AD)?\b/i))) {
    const y = Number(m[1]);
    const bc = /^BCE?$/i.test(m[2] ?? "");
    return { year: bc ? 1 - y : y, precision: "year", era: bc ? "bc" : "ad" };
  }
  return null;
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
  new RegExp(`^\\d{1,2}(st|nd|rd|th)?\\s+(${MONTHS})\\b`, "i").test(text.trim()) ||
  new RegExp(`^(${MONTHS})\\s+\\d{1,2}\\b`, "i").test(text.trim()) ||
  /^\d{1,2}\s*월/.test(text.trim());

/** 사건이 아니라 시대 구분으로 보이는가(editorial-policy §3-6 → polities). */
const looksLikePeriod = (text) =>
  text.length <= 24 && /(시대|시기|Period|Age|Era)\s*$/i.test(text.trim());

/**
 * 연도 표기의 시작 위치. 접두(기원전·BC.)를 포함해 잡는다 — 접두를 빼고 자르면
 * "BC.238년경"이 "238년경"이 되어 기원전 표시를 잃는다(파일럿 #8).
 */
const YEAR_MARK = /(?<![\d~–-])(?:기원전\s*|BC\.?\s*)?\d{1,4}\s*(?:년(?![\d대])|세기)/g;

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

/**
 * 문서 HTML → 후보 항목. 표와 목록을 모두 본다.
 *
 * 표 행은 두 모양이다(ko:한국사 연표, 2026-09-05 확인).
 *   ① [연도 | 본문] — 머리 연도 + 본문. 본문에 여러 해가 뭉쳐 있으면 쪼갠다.
 *   ② [<ul><li>…</li></ul>] 한 칸 — 근현대 구간. 머리 연도가 없고 항목마다 연도가 있다.
 * ②를 "셀 2개 미만"으로 건너뛰고 표 안 목록을 본문 목록 분기에서도 제외하면
 * 근현대가 통째로 사라진다(1945년 이후 360 → 205건으로 줄었던 원인).
 */
function extract(html) {
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
    const items = extract(html);

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
