import type { Metadata } from "next";
// Pretendard 가변 서체(대표 지시 2026-09-05). 동적 서브셋 — 한글 11,172자를 글리프 묶음별 @font-face로 나눠 쓰는 만큼만 받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "../globals.css";
import { rootMetadata } from "@/lib/metadata";

/**
 * 한국어 루트 레이아웃. 기본 언어라 접두 없이 `/`·`/sources`·`/y/{year}`에 있다.
 * 나머지 세 언어는 `app/(intl)/[locale]`에 같은 모양의 루트 레이아웃을 따로 둔다 —
 * `<html lang>`은 루트 레이아웃만 쓸 수 있고 그 값이 언어마다 달라야 하기 때문이다(Next 16 다중 루트 레이아웃).
 */
export const metadata: Metadata = rootMetadata("ko");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-full overflow-hidden bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
