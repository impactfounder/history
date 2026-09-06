import Link from "next/link";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { REGION_LABEL, T, formatYearL, localePath, type Locale } from "@/lib/i18n";
import { YEAR } from "@/lib/i18n-pages";
import { CONTEXT_YEARS, DATA_END_YEAR, dupNamesIn, labelOf, loadYear, polityLabel, summarize } from "@/lib/year-data";
import { LocaleNav } from "@/components/pages/LocaleNav";

/**
 * 연도 랜딩 본문 — PRD §5-8 `/y/{year}`. 서버 렌더 HTML 표: 그 해 모든 열의 사건 + 앞뒤 2년 문맥.
 * 검색 유입의 첫 화면이자 그리드(커스텀 조작)의 접근성 대안이다. 언어별 라우트가 이 컴포넌트를 공유한다.
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
      <article className="mx-auto max-w-5xl px-6 py-8 text-[14px] leading-relaxed [text-wrap:pretty] [word-break:keep-all]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="flex flex-wrap gap-x-3 text-[12px] text-neutral-500">
            <Link href={gridHref} className="underline">{c.toGrid(yl(year))}</Link>
            {/* 축 밖·수록 끝 밖으로는 링크하지 않는다 — 그 쪽은 생성되지 않은 페이지다 */}
            {year - 1 >= AXIS_YEAR_START && <Link href={localePath(locale, `/y/${year - 1}`)} className="underline">{yl(year - 1)}</Link>}
            {year + 1 <= DATA_END_YEAR && <Link href={localePath(locale, `/y/${year + 1}`)} className="underline">{yl(year + 1)}</Link>}
          </p>
          <LocaleNav locale={locale} path={`/y/${year}`} />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight [text-wrap:balance]">{c.h1(yl(year))}</h1>
        {/* 페이지마다 다른 요약 한 줄 — 검색 결과 스니펫이자 위키 원문과 겹치지 않는 우리 텍스트 */}
        <p className="mb-2 text-[15px] text-neutral-800">{summary}</p>
        <p className="mb-6 text-[13px] text-neutral-500">
          {c.note(total, <Link href={sourcesHref} className="underline">{t.licensePage}</Link>, CONTEXT_YEARS)}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left align-top text-[12px] text-neutral-600">
                {regions.map((r) => {
                  const p = polityAt(r.id);
                  const outside = r.coverage_from != null && year < r.coverage_from;
                  return (
                    <th key={r.id} className="px-2 py-2 font-medium">
                      {REGION_LABEL[locale][r.id]}
                      {p && <span className="ml-1.5 font-normal text-neutral-500">{polityLabel(p, locale)}</span>}
                      {outside && <span className="ml-1.5 font-normal text-neutral-400">{c.coverageFrom(r.coverage_from!)}</span>}
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
                  return (
                    <td key={r.id} className="border-r border-neutral-100 px-2 py-2 last:border-r-0">
                      <ul className="space-y-1.5">
                        {evs.map((e) => {
                          const focus = e.y0 === year;
                          const imp = e.regions[0]?.imp ?? 2;
                          const label = labelOf(e, locale, dup);
                          return (
                            <li key={e.id} className={focus ? (imp >= 5 ? "font-semibold" : imp === 4 ? "font-medium" : "") : "text-[12px] text-neutral-400"}>
                              {!focus && <span className="mr-1 tabular-nums">{e.y0 <= 0 ? `BC${1 - e.y0}` : e.y0}</span>}
                              <span lang={label.lang} className={e.hist === "traditional" ? "italic" : ""}>{label.text}</span>
                              {e.hist === "traditional" && <span className="text-neutral-400"> {t.traditional}</span>}
                              {e.official ? <span className="text-neutral-400" title={t.officialMark}> ◆</span> : null}
                            </li>
                          );
                        })}
                        {!evs.some((e) => e.y0 === year) && <li className="text-[12px] text-neutral-400">{c.noEvents}</li>}
                      </ul>
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
