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
import { decodeYears } from "@/lib/timeline/gap";
import { REGION_LABEL, dupNames,
  eventLabel, formatYearL, type LabelSource, type Locale, type RegionId } from "@/lib/i18n";
import { YEAR } from "@/lib/i18n-pages";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v1");
/** 그 해 위아래로 함께 보이는 문맥 연도 수. */
export const CONTEXT_YEARS = 2;
/**
 * **어느 열이든** 사건이 있는 마지막 해. 연도 페이지 생성 범위·사이트맵·「다음 해」 링크가 쓴다.
 *
 * 기본 열의 끝은 전년도(2025)지만 AI 열만 올해를 싣기 때문에(tools/derive.mjs `COVERAGE_TO`)
 * 페이지는 2026까지 있어야 한다 — 없으면 상세의 「2026년 페이지」 링크가 404가 된다.
 * 그 해의 다른 네 열은 "이 해 수록 사건 없음"으로 나온다. 그것이 정직한 답이다.
 */
export const DATA_END_YEAR = 2026;

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
/**
 * **어느 열이든 사건이 한 건이라도 있는 해.** 격자의 빈 구간 힌트가 쓰는 `years.json`(열별 사건 있는 해,
 * 델타 부호화)을 합친다 — 해마다 청크를 읽지 않아도 된다.
 *
 * 쓰는 곳: 사이트맵과 연도 페이지의 `robots`. 2026-09-24 진단에서 연도 페이지 2,526개 중 **609개(24%)가 그 해
 * 사건 0건**이었다 — 앞뒤 2년 문맥만 있는 빈 페이지가 네 언어로 2,436개 URL이 되어 사이트맵에 올라가 있었다.
 * 검색으로 들어온 사람이 빈 페이지에 떨어지지 않게, 그 해들은 사이트맵에서 빼고 `noindex`로 둔다.
 * 페이지 자체는 남긴다 — 「다음 해」 링크와 상세의 「그 해 페이지」가 404가 되면 안 된다.
 */
export const yearsWithEvents = cache(async (): Promise<Set<number>> => {
  const idx = (await readJson<{ years: Record<string, number[]> }>("years.json"))?.years ?? {};
  const out = new Set<number>();
  for (const delta of Object.values(idx)) for (const y of decodeYears(delta)) out.add(y);
  return out;
});

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

/**
 * 한 열 안에서 둘 이상 나오는 라벨. 규칙 자체는 `i18n.ts`의 `dupNames`에 한 벌만 있다 —
 * 그리드도 같은 것을 부른다(두 벌이던 시절에 둘이 갈라졌다).
 */
export const dupNamesIn = (evs: Ev[], locale: Locale): Set<string> => dupNames(evs, locale);

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
