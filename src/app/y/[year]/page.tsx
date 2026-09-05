import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { AXIS_YEAR_END, AXIS_YEAR_START, formatYear } from "@/lib/timeline/axis";

/**
 * 연도 랜딩 — PRD §5-8 `/y/{year}`. 서버 렌더 HTML 표: 그 해 모든 열의 사건 + 앞뒤 2년 문맥.
 * 검색 유입의 첫 화면이자 그리드(커스텀 조작)의 접근성 대안이다. 데이터는 발행된 정적 JSON을
 * 서버에서 직접 읽는다 — 읽기 경로는 여전히 public/data/v1 하나다(PRD §8).
 */

const DATA_DIR = path.join(process.cwd(), "public", "data", "v1");
const CONTEXT_YEARS = 2;

interface Region { id: string; label_ko: string; coverage_from?: number }
interface Ev { id: string; y0: number; title: string; lang: string; hist: string; names?: Partial<Record<string, { nat?: string | null }>>; regions: { r: string; imp: number }[]; official?: number }
interface Polity { name: string; label: string; y0: number; y1: number | null }

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
  const label = y === null ? "연도" : formatYear(y);
  return { title: `${label} — 그 해, 각 나라에 무슨 일 | history`, description: `${label}의 한국·중국·일본·미국 사건을 한 표에 놓는다.` };
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const year = parseYear((await params).year);
  if (year === null) notFound();

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
  const polityAt = (rid: string) => polities[rid]?.find((p) => p.y0 <= year && (p.y1 == null || year < p.y1));

  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-5xl px-6 py-8 text-[14px] leading-relaxed [text-wrap:pretty] [word-break:keep-all]">
        <p className="mb-4 flex flex-wrap gap-x-3 text-[12px] text-neutral-500">
          <Link href={`/?y=${year}&s=40`} className="underline">← 연표에서 {formatYear(year)} 보기</Link>
          <Link href={`/y/${year - 1}`} className="underline">{formatYear(year - 1)}</Link>
          <Link href={`/y/${year + 1}`} className="underline">{formatYear(year + 1)}</Link>
        </p>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight [text-wrap:balance]">{formatYear(year)}</h1>
        <p className="mb-6 text-neutral-600">
          그 해, 각 나라에 무슨 일이 있었나. 사건 {total}건 — 본문은 원천 연표 원문 그대로이며 출처는{" "}
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
                            {e.lang !== "ko" && e.names?.kr?.nat && <span className="font-medium">{e.names.kr.nat.replace(/\s*\([^)]*\)$/, "")}<span className="opacity-50"> · </span></span>}
                            <span className={e.hist === "traditional" ? "italic" : ""}>{e.title}</span>
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
