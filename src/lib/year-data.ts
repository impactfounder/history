/**
 * `/y/{year}` 연도 페이지의 데이터 읽기와 라벨 규칙 — 언어별 라우트 네 벌(`/y`·`/en/y`·`/ja/y`·`/zh/y`)이
 * 같은 함수를 쓴다. 읽기 경로는 여전히 발행된 정적 JSON 하나다(PRD §8).
 *
 * 라벨은 그리드 칩과 같은 규칙(i18n.eventLabel)을 지난다 — 그 언어 표제어가 **사건 이름 꼴**일 때만 이름,
 * 아니면 원문(한국어 UI는 기계 번역 우선). 지명·인물 표제어를 칩에 쓰지 않는 이유는 i18n.ts에 적혀 있다.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { AXIS_YEAR_END, AXIS_YEAR_START } from "@/lib/timeline/axis";
import { REGION_LABEL, eventLabel, formatYearL, type LabelSource, type Locale, type RegionId } from "@/lib/i18n";
import { YEAR } from "@/lib/i18n-pages";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v1");
/** 그 해 위아래로 함께 보이는 문맥 연도 수. */
export const CONTEXT_YEARS = 2;
/** 수록 끝(PRD C-2). tools/derive.mjs DATA_END_YEAR·sitemap과 같이 올린다. */
export const DATA_END_YEAR = 2025;

export interface Region { id: RegionId; label_ko: string; coverage_from?: number }
export interface Ev extends LabelSource {
  id: string;
  y0: number;
  hist: "historical" | "traditional";
  regions: { r: RegionId; imp: number }[];
  /** 국사편찬위 연표에 맞춰진 공식 항목 수(한국 열). */
  official?: number;
}
export interface Polity { name: string; names?: Partial<Record<Locale, string>>; label: string; y0: number; y1: number | null }
export interface YearData { regions: Region[]; polities: Record<string, Polity[]>; byRegion: Record<string, Ev[]>; total: number }

/**
 * 빌드(SSG) 때만 켜는 파일 캐시. 연도 페이지는 언어 4벌 × 2,525해라 같은 십년 청크를 수백 번 읽는다.
 * dev에서는 끈다 — `npm run publish:preview`로 다시 발행한 파일이 곧바로 보여야 한다.
 */
const CACHE_FILES = process.env.NODE_ENV === "production";
const fileMemo = new Map<string, unknown>();

async function readJson<T>(rel: string): Promise<T | null> {
  if (CACHE_FILES && fileMemo.has(rel)) return fileMemo.get(rel) as T | null;
  let value: T | null = null;
  try {
    value = JSON.parse(await readFile(path.join(DATA_DIR, rel), "utf8")) as T;
  } catch {
    value = null;
  }
  if (CACHE_FILES) fileMemo.set(rel, value);
  return value;
}

export const parseYear = (s: string): number | null => {
  const y = Number(s);
  return /^-?\d{1,4}$/.test(s) && y >= AXIS_YEAR_START && y <= AXIS_YEAR_END ? y : null;
};
const bucket10 = (y: number) => Math.floor(y / 10) * 10;
const byImp = (a: Ev, b: Ev) => (b.regions[0]?.imp ?? 0) - (a.regions[0]?.imp ?? 0);

/**
 * 그 해 ± 문맥 연도의 사건. `cache()`로 감싸 generateMetadata와 페이지 렌더가 한 번만 읽는다.
 */
export const loadYear = cache(async (year: number): Promise<YearData> => {
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
    byRegion[r.id] = evs.sort((a, b) => a.y0 - b.y0 || byImp(a, b));
  }
  const total = Object.values(byRegion).reduce((n, l) => n + l.filter((e) => e.y0 === year).length, 0);
  return { regions, polities, byRegion, total };
});

/** 한 열 안에서 둘 이상 나오는 표제어 — 그 이름은 라벨로 쓰지 않는다(그리드 셀과 같은 규칙). */
export function dupNamesIn(evs: Ev[], locale: Locale): Set<string> {
  const seen = new Map<string, number>();
  for (const e of evs) {
    const n = eventLabel(e, locale).name;
    if (n) seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

/** 칩 라벨과 그 언어. 표제어를 쓰면 UI 언어, 원문을 쓰면 원문 언어(한국어 옮김이 있으면 ko). */
export function labelOf(ev: Ev, locale: Locale, dup?: ReadonlySet<string>): { text: string; lang: string } {
  const l = eventLabel(ev, locale, dup);
  if (l.name !== undefined) return { text: l.name, lang: locale };
  const translated = locale === "ko" && ev.lang !== "ko" && Boolean(ev.title_ko);
  return { text: l.text ?? ev.title, lang: translated ? "ko" : ev.lang };
}

/**
 * 검색용 한 줄 요약 — 열마다 그 해 중요도 1위 사건을 이어 붙인다. 페이지마다 다른 문장이라
 * 위키 원문과 중복되지 않는 텍스트가 페이지에 생긴다(검색·애드센스의 "복제 콘텐츠" 대응).
 */
export function summarize(year: number, d: YearData, locale: Locale, maxLen = 155): string {
  const label = formatYearL(year, locale);
  const parts: string[] = [];
  for (const r of d.regions) {
    const top = d.byRegion[r.id]?.filter((e) => e.y0 === year).sort(byImp)[0];
    if (top) parts.push(`${REGION_LABEL[locale][r.id]}: ${labelOf(top, locale).text.replace(/[.。]$/, "")}`);
  }
  if (!parts.length) return YEAR[locale].summaryFallback(label);
  const s = `${label} — ${parts.join(" / ")}`;
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

/** 열 머리의 정치체 — 한국어는 발행 라벨 그대로, 다른 언어는 그 언어 표제어 + 연도(그리드와 같은 규칙). */
export function polityLabel(p: Polity, locale: Locale): string {
  if (locale === "ko") return p.label;
  const shortYear = (y: number) => formatYearL(y, locale).replace(/[년年]$/, "");
  return `${p.names?.[locale] ?? p.name} ${shortYear(p.y0)}–${p.y1 == null ? "" : shortYear(p.y1)}`;
}
