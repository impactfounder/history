import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { AXIS_YEAR_END, AXIS_YEAR_START, formatYear } from "@/lib/timeline/axis";
import { isEventName } from "@/lib/i18n";

/**
 * 연도 랜딩 — PRD §5-8 `/y/{year}`. 서버 렌더 HTML 표: 그 해 모든 열의 사건 + 앞뒤 2년 문맥.
 * 검색 유입의 첫 화면이자 그리드(커스텀 조작)의 접근성 대안이다. 데이터는 발행된 정적 JSON을
 * 서버에서 직접 읽는다 — 읽기 경로는 여전히 public/data/v1 하나다(PRD §8).
 */

const DATA_DIR = path.join(process.cwd(), "public", "data", "v1");
const CONTEXT_YEARS = 2;
/** 수록 끝(PRD C-2). tools/derive.mjs DATA_END_YEAR와 같이 올린다. */
const DATA_END_YEAR = 2025;

/**
 * 빌드 때 전부 정적으로 만든다(축 범위 2,525쪽). 서버리스에서는 public/의 파일을 fs로 읽을 수 없고,
 * 검색 유입 페이지는 CLS 0·즉시 응답이 목표라(§5-8) 요청 시 렌더가 아니라 SSG가 맞다.
 */
export const dynamicParams = false;
export function generateStaticParams() {
  return Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => ({ year: String(AXIS_YEAR_START + i) }));
}

interface Region { id: string; label_ko: string; coverage_from?: number }
interface Ev { id: string; y0: number; title: string; title_ko?: string; lang: string; hist: string; names?: Partial<Record<string, { nat?: string | null }>>; regions: { r: string; imp: number }[]; official?: number }
interface Polity { name: string; label: string; y0: number; y1: number | null }

/** 칩과 같은 라벨 규칙(i18n.eventLabel): 한국어 사건 이름이 있으면 그것, 없으면 번역 > 원문. 지명·인물 이름은 붙이지 않는다. */
const koName = (e: Ev) => e.names?.kr?.nat?.replace(/\s*\([^)]*\)$/, "");
const labelOf = (e: Ev) => { const n = koName(e); return n && isEventName(n, "ko") ? n : (e.title_ko ?? e.title); };

interface YearData { regions: Region[]; polities: Record<string, Polity[]>; byRegion: Record<string, Ev[]>; total: number }

/** 그 해 ± 문맥 연도의 사건. generateMetadata와 페이지가 같이 쓴다(빌드 때 두 번 읽어도 정적 파일이라 싸다). */
async function loadYear(year: number): Promise<YearData> {
  const regions = (await readJson<{ regions: Region[] }>("regions.json"))?.regions ?? [];
  const polities = (await readJson<{ regions: Record<string, Polity[]> }>("polities.json"))?.regions ?? {};
  const years = Array.from({ length: CONTEXT_YEARS * 2 + 1 }, (_, i) => year - CONTEXT_YEARS + i);
  const buckets = [...new Set(years.map(bucket10))];
  // 열 × 연도 → 사건. 같은 십년 청크는 한 번만 읽는다.
  const byRegion: Record<string, Ev[]> = {};
  for (const r of regions) {
    const evs: Ev[] = [];
    for (const b of buckets) {
      const chunk = await readJson<{ events: Ev[] }>(`events/${r.id}/year/${b}.json`);
      if (chunk) evs.push(...chunk.events.filter((e) => years.includes(e.y0)));
    }
    byRegion[r.id] = evs.sort((a, b) => a.y0 - b.y0 || (b.regions[0]?.imp ?? 0) - (a.regions[0]?.imp ?? 0));
  }
  const total = Object.values(byRegion).reduce((n, l) => n + l.filter((e) => e.y0 === year).length, 0);
  return { regions, polities, byRegion, total };
}

/**
 * 검색용 한 줄 요약 — 열마다 그 해 중요도 1위 사건을 이어 붙인다. 페이지마다 다른 문장이라
 * 위키 원문과 중복되지 않는 텍스트가 페이지에 생긴다(검색·애드센스의 "복제 콘텐츠" 대응).
 */
function summarize(year: number, d: YearData, maxLen = 155): string {
  const parts: string[] = [];
  for (const r of d.regions) {
    const top = d.byRegion[r.id]?.filter((e) => e.y0 === year).sort((a, b) => (b.regions[0]?.imp ?? 0) - (a.regions[0]?.imp ?? 0))[0];
    if (top) parts.push(`${r.label_ko}: ${labelOf(top).replace(/[.。]$/, "")}`);
  }
  if (!parts.length) return `${formatYear(year)}에 한국·중국·일본·미국에서 있었던 일을 같은 해 축 위에 나란히 놓는다.`;
  let s = `${formatYear(year)} — ${parts.join(" / ")}`;
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + "…";
  return s;
}

async function readJson<T>(rel: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, rel), "utf8")) as T;
  } catch {
    return null;
  }
}

const parseYear = (s: string): number | null => {
  const y = Number(s);
  return /^-?\d{1,4}$/.test(s) && y >= AXIS_YEAR_START && y <= AXIS_YEAR_END ? y : null;
};
const bucket10 = (y: number) => Math.floor(y / 10) * 10;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const y = parseYear((await params).year);
  if (y === null) return { title: "연도" };
  const label = formatYear(y);
  // 검색어는 질문형("1882년에 무슨 일이 있었나")으로 들어온다 — 제목도 그 말로
  const title = `${label}에 무슨 일이 있었나 — 한국·중국·일본·미국 같은 해 비교`;
  const description = summarize(y, await loadYear(y));
  return {
    title,
    description,
    alternates: { canonical: y === null ? undefined : `/y/${y}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const year = parseYear((await params).year);
  if (year === null) notFound();

  const data = await loadYear(year);
  const { regions, polities, byRegion, total } = data;
  const polityAt = (rid: string) => polities[rid]?.find((p) => p.y0 <= year && (p.y1 == null || year < p.y1));
  const summary = summarize(year, data, 400);

  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-5xl px-6 py-8 text-[14px] leading-relaxed [text-wrap:pretty] [word-break:keep-all]">
        <p className="mb-4 flex flex-wrap gap-x-3 text-[12px] text-neutral-500">
          <Link href={`/?y=${year}&s=40`} className="underline">← 연표에서 {formatYear(year)} 보기</Link>
          <Link href={`/y/${year - 1}`} className="underline">{formatYear(year - 1)}</Link>
          <Link href={`/y/${year + 1}`} className="underline">{formatYear(year + 1)}</Link>
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight [text-wrap:balance]">{formatYear(year)}, 그 해 각 나라에 무슨 일이 있었나</h1>
        {/* 페이지마다 다른 요약 한 줄 — 검색 결과 스니펫이자 위키 원문과 겹치지 않는 우리 텍스트 */}
        <p className="mb-2 text-[15px] text-neutral-800">{summary}</p>
        <p className="mb-6 text-[13px] text-neutral-500">
          사건 {total}건. 본문은 원천 연표 원문 그대로이며 출처는{" "}
          <Link href="/sources" className="underline">출처와 라이선스</Link>에 있다. 아래위 회색 줄은 앞뒤 {CONTEXT_YEARS}년 문맥이다.
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
                      {r.label_ko}
                      {p && <span className="ml-1.5 font-normal text-neutral-500">{p.label}</span>}
                      {outside && <span className="ml-1.5 font-normal text-neutral-400">{r.coverage_from}년~ 수록</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                {regions.map((r) => (
                  <td key={r.id} className="border-r border-neutral-100 px-2 py-2 last:border-r-0">
                    <ul className="space-y-1.5">
                      {byRegion[r.id]?.map((e) => {
                        const focus = e.y0 === year;
                        const imp = e.regions[0]?.imp ?? 2;
                        return (
                          <li key={e.id} className={focus ? (imp >= 5 ? "font-semibold" : imp === 4 ? "font-medium" : "") : "text-[12px] text-neutral-400"}>
                            {!focus && <span className="mr-1 tabular-nums">{e.y0 <= 0 ? `BC${1 - e.y0}` : e.y0}</span>}
                            <span lang={labelOf(e) === e.title ? e.lang : "ko"} className={e.hist === "traditional" ? "italic" : ""}>{labelOf(e)}</span>
                            {e.hist === "traditional" && <span className="text-neutral-400"> (전승)</span>}
                            {e.official ? <span className="text-neutral-400" title="국사편찬위원회 연표에 있는 사건"> ◆</span> : null}
                          </li>
                        );
                      })}
                      {!byRegion[r.id]?.some((e) => e.y0 === year) && <li className="text-[12px] text-neutral-400">이 해 수록 사건 없음</li>}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </main>
  );
}
