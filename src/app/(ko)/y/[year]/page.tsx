import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { YearArticle } from "@/components/pages/YearArticle";
import { yearMetadata } from "@/lib/metadata";
import { DATA_END_YEAR, parseYear } from "@/lib/year-data";

/**
 * 한국어 연도 랜딩. 다른 언어는 `app/(intl)/[locale]/y/[year]`가 같은 컴포넌트를 로케일만 바꿔 렌더한다.
 *
 * 빌드 때 전부 정적으로 만든다(축 범위 2,525쪽). 서버리스에서는 public/의 파일을 fs로 읽을 수 없고,
 * 검색 유입 페이지는 CLS 0·즉시 응답이 목표라(§5-8) 요청 시 렌더가 아니라 SSG가 맞다.
 */
export const dynamicParams = false;
export function generateStaticParams() {
  return Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => ({ year: String(AXIS_YEAR_START + i) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const y = parseYear((await params).year);
  if (y === null) return { title: "연도" };
  return yearMetadata(y, "ko");
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const year = parseYear((await params).year);
  if (year === null) notFound();
  return <YearArticle year={year} locale="ko" />;
}
