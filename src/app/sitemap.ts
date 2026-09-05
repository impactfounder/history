import type { MetadataRoute } from "next";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { SITE_URL } from "@/lib/site";

/** 수록 끝(PRD C-2). tools/derive.mjs DATA_END_YEAR·/y 페이지와 같이 올린다. */
const DATA_END_YEAR = 2025;

/**
 * 색인 대상(PRD §5-8): `/`, `/sources`, `/y/{year}`(검색 유입 랜딩). 열 조합 URL(`/?r=`)은 noindex —
 * canonical이 `/`라 따로 싣지 않는다. 2,527개 — 한 파일 상한 5만 안.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const years = Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => AXIS_YEAR_START + i);
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/sources`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ...years.map((y) => ({ url: `${SITE_URL}/y/${y}`, lastModified: now, changeFrequency: "monthly" as const, priority: y >= 1800 ? 0.6 : 0.4 })),
  ];
}
