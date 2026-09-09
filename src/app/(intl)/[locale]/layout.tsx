import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import { notFound } from "next/navigation";
// Pretendard 가변 서체 — 한글 문서 제목·인용이 섞여 나오므로 다른 언어에서도 같은 서체를 쓴다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "../../globals.css";

/**
 * 명조체 — 시대·연도 라벨 전용(README §규칙 2). 배경을 칠하지 않고도 시간 채널을
 * 사건 채널과 분리한다. 붙는 곳은 넷뿐이다: 축의 연도 라벨, 열 헤더의 왕조 이름,
 * 상세 패널의 날짜 줄, 연도 페이지의 h1. 본문에는 쓰지 않는다.
 * 한글은 next/font가 unicode-range로 나눠 받으므로 subsets에 latin만 적는다.
 */
const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});
import { PREFIXED_LOCALES, isLocale } from "@/lib/i18n";
import { rootMetadata } from "@/lib/metadata";

/**
 * 영어·일본어·중국어 문서 페이지의 루트 레이아웃 — `/en/y/1592`, `/ja/sources` …
 * 한국어는 기본 언어라 접두 없이 `app/(ko)`에 있다. 루트 레이아웃을 둘로 나눈 이유는 하나다:
 * `<html lang>`은 루트 레이아웃만 쓸 수 있는데 그 값이 언어마다 달라야 한다(Next 16 다중 루트 레이아웃).
 * 그룹을 넘나드는 이동은 전체 새로고침이지만, 여기 이동은 문서 ↔ 문서라 상관없다.
 */
export const dynamicParams = false;
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return rootMetadata(locale);
}

export default async function IntlRootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // 한국어가 접두로 들어오면(`/ko/…`) 그 URL은 없다 — 정본은 접두 없는 `/`다
  if (!isLocale(locale) || locale === "ko") notFound();
  return (
    <html lang={locale} className={notoSerifKr.variable}>
      <body className="h-full overflow-hidden bg-surface text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
