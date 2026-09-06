import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { YearArticle } from "@/components/pages/YearArticle";
import { isLocale } from "@/lib/i18n";
import { yearMetadata } from "@/lib/metadata";
import { DATA_END_YEAR, parseYear } from "@/lib/year-data";

/**
 * 영어·일본어·중국어 연도 랜딩. 한국어(`app/(ko)/y/[year]`)와 같은 컴포넌트를 로케일만 바꿔 렌더한다.
 * 로케일은 부모 레이아웃이 만들고, 여기서는 그 로케일마다 연도를 만든다(위에서 아래로).
 */
export const dynamicParams = false;
export function generateStaticParams() {
  return Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => ({ year: String(AXIS_YEAR_START + i) }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; year: string }> }): Promise<Metadata> {
  const { locale, year } = await params;
  const y = parseYear(year);
  if (!isLocale(locale) || y === null) return {};
  return yearMetadata(y, locale);
}

export default async function YearPage({ params }: { params: Promise<{ locale: string; year: string }> }) {
  const { locale, year } = await params;
  const y = parseYear(year);
  if (!isLocale(locale) || y === null) notFound();
  return <YearArticle year={y} locale={locale} />;
}
