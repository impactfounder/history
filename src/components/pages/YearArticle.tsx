import Link from "next/link";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { REGION_LABEL, T, formatYearL, localePath, type Locale } from "@/lib/i18n";
import { itemKind } from "@/lib/timeline/item-kind";
import { YEAR } from "@/lib/i18n-pages";
import { CONTEXT_YEARS, DATA_END_YEAR, dupNamesIn, labelOf, loadYear, polityLabel, summarize } from "@/lib/year-data";
import { LocaleNav } from "@/components/pages/LocaleNav";

/**
 * 연도 랜딩 본문 — PRD §5-8 `/y/{year}`. 서버 렌더 HTML 표: 그 해 모든 열의 사건 + 앞뒤 2년 문맥.
 * 검색 유입의 첫 화면이자 그리드(커스텀 조작)의 접근성 대안이다. 언어별 라우트가 이 컴포넌트를 공유한다.
 *
 * 1b: 표 구조(table-fixed, 열 = 나라, 한 행)는 그대로 두고 타이포만 정리했다.
 *  - 제목은 명조 40px. 시대·연도는 서체로 갈린다(README 규칙 2)
 *  - 위계는 격자와 같은 2단 — UI 언어로 읽히면 lead, 원문 그대로면 plain + 언어 태그(itemKind)
 *  - 앞뒤 문맥 연도는 같은 목록에 섞지 않고 실낱 선 아래로 내린다
 *  - 수록 범위 밖 열은 머리의 꼬리표가 아니라 본문 한 줄로("미국 열은 1776년부터 수록한다")
 * 개수를 줄이지는 않는다 — 색인되는 페이지라 접힌 항목은 없느니만 못하다.
 */
export async function YearArticle({ year, locale }: { year: number; locale: Locale }) {
  const data = await loadYear(year);
  const { regions, polities, byRegion, total } = data;
  const t = T[locale];
  const c = YEAR[locale];
  const yl = (y: number) => formatYearL(y, locale);
  const summary = summarize(year, data, locale, 400);
  const polityAt = (rid: string) => polities[rid]?.find((p) => p.y0 <= year && (p.y1 == null || year < p.y1));
  // 그리드로 돌아갈 때 UI 언어를 잃지 않는다 — 그리드는 `?lang=`로 언어를 받는다
  const gridHref = `/?y=${year}&s=40${locale === "ko" ? "" : `&lang=${locale}`}`;
  const sourcesHref = localePath(locale, "/sources");

  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-5xl px-12 py-11 text-body [text-wrap:pretty] [word-break:keep-all]">
        <div className="mb-7 flex items-start justify-between gap-4">
          <p className="flex flex-wrap gap-x-3 text-item-meta text-fg-subtle">
            <Link href={gridHref} className="underline">{c.toGrid(yl(year))}</Link>
            {/* 축 밖·수록 끝 밖으로는 링크하지 않는다 — 그 쪽은 생성되지 않은 페이지다 */}
            {year - 1 >= AXIS_YEAR_START && <Link href={localePath(locale, `/y/${year - 1}`)} className="tabular-nums underline">{yl(year - 1)}</Link>}
            {year + 1 <= DATA_END_YEAR && <Link href={localePath(locale, `/y/${year + 1}`)} className="tabular-nums underline">{yl(year + 1)}</Link>}
          </p>
          <LocaleNav locale={locale} path={`/y/${year}`} />
        </div>

        <h1 className="font-serif text-h1 font-semibold tracking-[-.02em] tabular-nums [text-wrap:balance]">{yl(year)}</h1>
        {/* 페이지마다 다른 요약 한 줄 — 검색 결과 스니펫이자 위키 원문과 겹치지 않는 우리 텍스트 */}
        <p className="mt-3 text-lead text-fg-strong">{summary}</p>
        <p className="mt-2 text-meta text-fg-subtle">
          {c.note(total, <Link href={sourcesHref} className="underline">{t.licensePage}</Link>, CONTEXT_YEARS)}
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-line-strong text-left align-bottom">
                {regions.map((r) => {
                  const p = polityAt(r.id);
                  return (
                    // 나라 이름 위, 왕조 아래 — 한 줄에 나란히 두면 「아즈치모모야마 시대」가 줄바꿈된다
                    <th key={r.id} className="px-3 pb-2 align-bottom font-normal">
                      <span className="block text-body font-bold" style={{ color: `var(--color-region-${r.id})` }}>
                        {REGION_LABEL[locale][r.id]}
                      </span>
                      {p && <span className="mt-0.5 block truncate font-serif text-item-meta text-fg-muted">{polityLabel(p, locale)}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                {regions.map((r) => {
                  const evs = byRegion[r.id] ?? [];
                  const dup = dupNamesIn(evs, locale);
                  const here = evs.filter((e) => e.y0 === year);
                  const around = evs.filter((e) => e.y0 !== year);
                  const outside = r.coverage_from != null && year < r.coverage_from;
                  return (
                    <td key={r.id} className="border-r border-line-hairline px-3 pt-3 align-top last:border-r-0">
                      {outside ? (
                        <p className="text-meta text-fg-subtle">{c.coverageFrom(r.coverage_from!)}</p>
                      ) : (
                        <>
                          <ul className="space-y-[7px]">
                            {here.map((e) => {
                              const label = labelOf(e, locale, dup);
                              const kind = itemKind(e, locale);
                              return (
                                /*
                                  **줄마다 앵커를 준다.** `/y/1592#ev_…`가 특정 사건을 가리킨다 —
                                  검색 결과·공유 링크가 닿을 자리가 여기 생긴다.

                                  그리고 이름을 **격자 딥링크**로 건다. 연도 페이지의 내부 링크가
                                  여태 연도±1뿐이라 2,525년짜리 선형 사슬이었는데, 이 링크가 그
                                  사슬을 격자와 잇는다. `?e=`는 그 사건 패널까지 연다.

                                  SEO 효과는 과장하지 않는다 — `/?…` 조합 URL은 noindex다.
                                  이 변경의 값은 **사람이 찾아가는 길**이고, 크롤러에게는 앵커가
                                  생기는 것까지다.
                                */
                                <li key={e.id} id={e.id} className={kind === "lead" ? "font-semibold" : "text-fg-strong"}>
                                  <Link
                                    href={`/?y=${e.y0}&s=40&e=${e.id}${locale === "ko" ? "" : `&lang=${locale}`}`}
                                    lang={label.lang}
                                    className={`hover:underline ${e.hist === "traditional" ? "italic" : ""}`}
                                  >
                                    {label.text}
                                  </Link>
                                  {kind === "plain" && (
                                    <span className="ml-1.5 rounded border border-line px-1 align-[1px] text-block-label text-fg-subtle">{e.lang.toUpperCase()}</span>
                                  )}
                                  {e.hist === "traditional" && <span className="text-fg-subtle"> {t.traditional}</span>}
                                </li>
                              );
                            })}
                            {here.length === 0 && <li className="text-meta text-fg-subtle">{c.noEvents}</li>}
                          </ul>
                          {/* 앞뒤 문맥 연도 — 같은 목록에 섞으면 그 해의 일과 구분되지 않는다 */}
                          {around.length > 0 && (
                            <ul className="mt-4 space-y-1.5 border-t border-line-hairline pt-3 text-meta text-fg-subtle">
                              {around.map((e) => {
                                const label = labelOf(e, locale, dup);
                                return (
                                  <li key={e.id} id={e.id}>
                                    {/*
                                      연도 표기는 `formatYearL`로 — 이 줄만 손으로 "BC"를 쓰고 있어서
                                      같은 페이지의 h1·요약이 「기원전 479년」·「公元前479年」일 때
                                      여기만 `BC479`가 나왔다(ja·zh·en UI에서).
                                    */}
                                    <span className="mr-1 tabular-nums">{yl(e.y0)}</span>
                                    <Link
                                      href={`/?y=${e.y0}&s=40&e=${e.id}${locale === "ko" ? "" : `&lang=${locale}`}`}
                                      lang={label.lang}
                                      className={`hover:underline ${e.hist === "traditional" ? "italic" : ""}`}
                                    >
                                      {label.text}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </main>
  );
}
