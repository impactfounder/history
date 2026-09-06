import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { formatYearL, localePath, type Locale } from "@/lib/i18n";
import { SITE_COPY, SOURCES, YEAR, languageAlternates } from "@/lib/i18n-pages";
import { loadYear, summarize } from "@/lib/year-data";

/**
 * 언어별 메타데이터 — 라우트 파일은 이 함수만 부른다. 한 페이지의 canonical과 hreflang이 한 군데서 나와야
 * 언어 네 벌이 어긋나지 않는다(PRD §5-8: 색인 대상은 언어별 URL).
 */

/** 루트 레이아웃 두 벌(`(ko)`·`(intl)/[locale]`)이 공유하는 사이트 머리말. */
export function rootMetadata(locale: Locale): Metadata {
  const c = SITE_COPY[locale];
  const title = `${SITE_NAME} — ${c.tagline}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description: c.description,
    openGraph: { type: "website", siteName: SITE_NAME, locale: c.ogLocale, title, description: c.description },
  };
}

export function sourcesMetadata(locale: Locale): Metadata {
  const c = SOURCES[locale];
  return {
    title: c.title,
    description: c.metaDescription,
    alternates: { canonical: localePath(locale, "/sources"), languages: languageAlternates("/sources") },
  };
}

export async function yearMetadata(year: number, locale: Locale): Promise<Metadata> {
  const label = formatYearL(year, locale);
  const title = YEAR[locale].metaTitle(label);
  const description = summarize(year, await loadYear(year), locale);
  const path = `/y/${year}`;
  return {
    title,
    description,
    alternates: { canonical: localePath(locale, path), languages: languageAlternates(path) },
    openGraph: { title, description, type: "article", locale: SITE_COPY[locale].ogLocale },
  };
}
