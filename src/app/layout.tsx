import type { Metadata } from "next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — 나라별 비교 연표`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  // 열 조합·연도·스케일이 붙은 `/?r=&y=&s=`는 전부 `/`가 정본(PRD §5-8)
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "ko_KR", title: `${SITE_NAME} — 나라별 비교 연표`, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-full overflow-hidden bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
