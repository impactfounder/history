import type { MetadataRoute } from "next";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { LOCALES, localePath } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { DATA_END_YEAR } from "@/lib/year-data";

/**
 * 색인 대상(PRD §5-8): `/`, `/sources`, `/y/{year}`(검색 유입 랜딩) — 문서 페이지는 언어 네 벌.
 * 열 조합 URL(`/?r=`)은 noindex — canonical이 `/`라 따로 싣지 않는다. 그리드도 언어가 URL에 없어 한 줄이다.
 * 언어 간 대응(hreflang)은 각 페이지의 `<link rel="alternate">`로 나간다(lib/metadata.ts) — 사이트맵에
 * 다시 싣지 않는다. 10,105개 — 한 파일 상한 5만 안.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const years = Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => AXIS_YEAR_START + i);
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...LOCALES.map((l) => ({ url: `${SITE_URL}${localePath(l, "/sources")}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...LOCALES.flatMap((l) =>
      years.map((y) => ({
        url: `${SITE_URL}${localePath(l, `/y/${y}`)}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: y >= 1800 ? 0.6 : 0.4,
      })),
    ),
  ];
}
