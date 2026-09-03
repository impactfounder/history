import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "history — 나라별 비교 연표",
  description:
    "여러 나라의 역사를 같은 연도 축 위에 나란히 놓고 비교한다. 그 해, 그 나라에 무슨 일이 있었나.",
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
