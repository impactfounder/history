import type { Metadata } from "next";
import { TimelineGrid } from "@/components/timeline/TimelineGrid";

/**
 * 그리드 홈. 언어는 URL이 아니라 `?lang=`으로 바꾼다 — 색인 대상이 아니고(canonical은 늘 `/`),
 * 언어를 바꿀 때마다 전체 새로고침이 나면 스크롤·줌 상태가 날아가기 때문이다.
 * 색인 대상인 문서 페이지(`/y`·`/sources`)만 언어별 URL을 쓴다(PRD §5-8).
 */

// 열 조합·연도·스케일이 붙은 `/?r=&y=&s=`는 전부 `/`가 정본(PRD §5-8)
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return <TimelineGrid />;
}
