/**
 * 원천 프로브 — data-model §4-1의 연표 문서가 지금도 존재하고, 표 구조가
 * 우리가 기대한 모양인지 실제로 받아서 확인한다.
 *
 * 왜 지금 이걸 하나: §4-1은 "2026-09-03 실존 확인"이라고 적혀 있지만 그 뒤로
 * 문서가 바뀌었을 수 있고, 무엇보다 **QID 부착 가능 비율**(= 표 행에 위키
 * 링크가 붙어 있는 비율)을 아직 아무도 재지 않았다. 이 값이 낮으면
 * data-model §5의 "1인 시간당 100건" 가정과 M1 일정이 통째로 바뀐다.
 *
 * 이 스크립트는 세지 않고 판단하지 않는다 — 숫자만 낸다. 실제 수집기는
 * 제대로 된 HTML 파서를 쓸 것이고, 여기 정규식은 프로브 정밀도로 충분하다.
 *
 * 사용: node tools/source-probe.mjs
 *       MVMT_CONTACT=you@example.com node tools/source-probe.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

// 위키미디어 API 예절: User-Agent에 연락처를 넣도록 요구한다.
// 개인 이메일을 코드에 박지 않고 환경변수로 받는다.
const CONTACT = process.env.MVMT_CONTACT ?? "contact-not-set";
const UA = `history-timeline-probe/0.1 (research; ${CONTACT})`;

/** data-model §4-1의 원천. `region`은 열, `role`은 §4-1의 쓰임. */
const SOURCES = [
  // 한국 — ko 연표는 개요 수준이라 en 연표로 보강한다(2026-09-04 프로브)
  { wiki: "ko", title: "한국사 연표", region: "kr", role: "연표(1순위)" },
  { wiki: "en", title: "Timeline of Korean history", region: "kr", role: "연표 보강" },
  // 세계 보조
  { wiki: "ko", title: "세계사 연표", region: "world", role: "세계 보조(1순위)" },
  // 중국·일본
  { wiki: "en", title: "Timeline of Chinese history", region: "cn", role: "연표(2순위)" },
  { wiki: "en", title: "Timeline of Japanese history", region: "jp", role: "연표(2순위)" },
  // 미국 — 단일 문서가 아니라 시기별로 쪼개져 있다(§4-1 "하위 문서 순회 필요")
  { wiki: "en", title: "Timeline of pre–United States history", region: "us", role: "연표(시기별)" },
  ...[
    "1790–1819", "1820–1859", "1860–1899", "1900–1929", "1930–1949",
    "1950–1969", "1970–1989", "1990–2009", "2010–present",
  ].map((p) => ({
    wiki: "en",
    title: `Timeline of the history of the United States (${p})`,
    region: "us",
    role: "연표(시기별)",
  })),
  // 정치체 밴드
  { wiki: "ko", title: "일본사 시대 구분표", region: "jp", role: "정치체 밴드(4순위)" },
];

async function fetchParse({ wiki, title }, tries = 4) {
  const url =
    `https://${wiki}.wikipedia.org/w/api.php?action=parse` +
    `&page=${encodeURIComponent(title)}` +
    `&prop=text%7Crevid%7Cdisplaytitle&format=json&formatversion=2&redirects=1`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429) {
      // 익명 요청은 제한이 빡빡하다. Retry-After를 존중하고 지수 백오프.
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1500 * 2 ** i;
      process.stderr.write(`429 · ${wait}ms 대기 … `);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    if (json.error) return { ok: false, error: json.error.code, info: json.error.info };
    return { ok: true, parse: json.parse };
  }
  return { ok: false, status: 429 };
}

const strip = (html) =>
  html
    .replace(/<sup[\s\S]*?<\/sup>/g, "") // 각주 번호
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** 첫 셀이 연도로 읽히는가. 한국어·영어 표기를 모두 본다. */
function looksLikeYear(text) {
  if (!text) return false;
  const t = text.replace(/,/g, "").trim();
  return (
    /^기원전\s*\d{1,7}\s*년?/.test(t) ||
    /^BC\.?\s*\d{1,7}/i.test(t) ||
    /^\d{1,4}\s*년/.test(t) ||
    /^\d{1,4}\s*(BCE?|CE|AD)?\s*$/i.test(t) ||
    /^\d{3,4}\s*[–—-]\s*\d{1,4}/.test(t) ||
    /^c\.?\s*\d{3,4}/i.test(t)
  );
}

const BODY_LINK = /<a[^>]+href="\/wiki\/(?!(파일|File|Help|도움말|Special|특수|Category|분류|Portal|위키백과|Wikipedia):)/;

/**
 * 프로브 정밀도의 구조 분석.
 *
 * 위키백과 연표 문서는 **표만 쓰지 않는다.** 상당수가 "* 1790 — 사건" 형태의
 * 불릿 목록이다(2026-09-04 확인: 미국 시기별 문서, en:Timeline of Korean history).
 * 표만 세면 그런 문서가 "원천 없음"으로 잘못 보인다.
 *
 * 중첩 표는 정확히 다루지 못한다. 실제 수집기는 HTML 파서를 쓴다.
 */
function analyze(html) {
  const yearSamples = [];
  const note = (s) => {
    if (yearSamples.length < 3) yearSamples.push(s);
  };

  // 1) wikitable 행
  const tables = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g) ?? [];
  let tableRows = 0;
  let tableYearRows = 0;
  let linked = 0;
  for (const table of tables) {
    for (const tr of table.split(/<tr[^>]*>/).slice(1)) {
      const cells = tr.split(/<t[dh][^>]*>/).slice(1);
      if (cells.length === 0) continue;
      tableRows++;
      const first = strip(cells[0] ?? "");
      if (looksLikeYear(first)) {
        tableYearRows++;
        note(first);
        if (BODY_LINK.test(tr)) linked++;
      }
    }
  }

  // 2) 연도로 시작하는 목록 항목 — 목차·각주·내비게이션은 이 조건에서 걸러진다
  // 표 셀 안의 목록은 이미 표 행으로 셌다 — 그대로 두면 두 번 센다(2026-09-05 수정.
  // 이전 보고서의 후보 행은 표 안 목록을 중복 집계해 부풀려져 있었다).
  const withoutTables = html.replace(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g, "");
  const lis = withoutTables.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
  let listItems = 0;
  for (const li of lis) {
    const text = strip(li);
    if (!looksLikeYear(text)) continue;
    listItems++;
    note(text.slice(0, 40));
    if (BODY_LINK.test(li)) linked++;
  }

  const candidates = tableYearRows + listItems;
  return { tableCount: tables.length, tableRows, tableYearRows, listItems, candidates, linked, yearSamples };
}

const pct = (a, b) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(0)}%`);

async function main() {
  if (CONTACT === "contact-not-set") {
    console.warn("⚠ MVMT_CONTACT가 없어 User-Agent에 연락처가 비어 있다. 위키미디어 예절상 채우는 게 맞다.\n");
  }

  const outDir = "curation/_probe";
  await mkdir(outDir, { recursive: true });
  const results = [];

  for (const src of SOURCES) {
    process.stderr.write(`받는 중: ${src.wiki}:${src.title} … `);
    const r = await fetchParse(src);
    if (!r.ok) {
      process.stderr.write(`실패 (${r.error ?? r.status})\n`);
      results.push({ ...src, ok: false, reason: r.error ?? `HTTP ${r.status}` });
      await sleep(300);
      continue;
    }
    const html = r.parse.text;
    const a = analyze(html);
    process.stderr.write(`표 ${a.tableCount}개 · 행 ${a.rows}\n`);
    results.push({
      ...src,
      ok: true,
      resolvedTitle: r.parse.title,
      pageid: r.parse.pageid,
      revid: r.parse.revid,
      htmlBytes: html.length,
      ...a,
    });
    // 원본 HTML은 레포에 넣지 않는다 — CC BY-SA 본문이고 용량도 크다.
    // 구조를 다시 보고 싶으면 이 스크립트를 다시 돌린다.
    await sleep(900); // 예절 + 429 회피
  }

  const stamp = new Date().toLocaleDateString("sv-SE");
  const lines = [
    "# 원천 프로브 결과",
    "",
    `| 측정일 | ${stamp} |`,
    "|---|---|",
    "| 도구 | `tools/source-probe.mjs` |",
    "| 대상 | `data-model §4-1` 연표 문서 |",
    "",
    "**`후보 행`이 핵심 숫자다** — 첫 셀이 연도로 읽히는 표 행 + 연도로 시작하는 목록 항목.",
    "즉 우리가 사건으로 뽑아낼 수 있는 줄 수다. `링크 보유`는 그중 본문 위키 링크가 있는 비율로,",
    "**QID 부착 가능 비율의 상한**이다.",
    "",
    "| 원천 | 열 | 상태 | revid | 표 | 표 행 | 연도 행 | 목록 항목 | **후보 행** | 링크 보유 |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...results.map((r) =>
      r.ok
        ? `| ${r.wiki}:${r.resolvedTitle} | ${r.region} | 존재 | ${r.revid} | ${r.tableCount} | ${r.tableRows} | ${r.tableYearRows} | ${r.listItems} | **${r.candidates}** | ${pct(r.linked, r.candidates)} |`
        : `| ${r.wiki}:${r.title} | ${r.region} | **${r.reason}** | — | — | — | — | — | — |`,
    ),
    "",
    `**열별 후보 행 합계** — ${["kr", "cn", "jp", "us", "world"]
      .map((rg) => `${rg} ${results.filter((r) => r.ok && r.region === rg).reduce((s, r) => s + r.candidates, 0)}`)
      .join(" · ")}`,
    "",
    "## 연도 셀 표본",
    "",
    ...results.filter((r) => r.ok).map((r) => `- ${r.wiki}:${r.resolvedTitle} — ${r.yearSamples.length ? r.yearSamples.map((s) => `\`${s}\``).join(", ") : "없음"}`),
    "",
    "## 한계",
    "",
    "- 정규식 기반이라 중첩 표를 정확히 다루지 못한다. 실제 수집기는 HTML 파서를 쓴다.",
    "- 위키백과 연표는 표와 불릿 목록을 섞어 쓴다. 표만 세면 목록형 문서가 '원천 없음'으로 보인다.",
    "- `링크 보유`는 상한이다. 링크가 있어도 그 문서에 Wikidata QID가 없거나, 사건이 아닌",
    "  인물·지명 링크일 수 있다. 실제 부착률은 이보다 낮다.",
    "- 머리행이 행 수에 포함돼 있어 실제 사건 행은 표 개수만큼 적다.",
  ];

  await writeFile(`${outDir}/report.md`, lines.join("\n") + "\n", "utf8");
  await writeFile(`${outDir}/raw-summary.json`, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
