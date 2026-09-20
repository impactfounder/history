import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
// Pretendard 가변 서체(대표 지시 2026-09-05). 동적 서브셋 — 한글 11,172자를 글리프 묶음별 @font-face로 나눠 쓰는 만큼만 받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "../globals.css";

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
import { ThemeScript } from "@/components/ThemeScript";
import { rootMetadata } from "@/lib/metadata";

/**
 * 한국어 루트 레이아웃. 기본 언어라 접두 없이 `/`·`/sources`·`/y/{year}`에 있다.
 * 나머지 세 언어는 `app/(intl)/[locale]`에 같은 모양의 루트 레이아웃을 따로 둔다 —
 * `<html lang>`은 루트 레이아웃만 쓸 수 있고 그 값이 언어마다 달라야 하기 때문이다(Next 16 다중 루트 레이아웃).
 */
export const metadata: Metadata = rootMetadata("ko");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSerifKr.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="h-full overflow-hidden bg-surface text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
