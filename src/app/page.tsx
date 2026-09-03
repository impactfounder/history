import { TimelineGrid } from "@/components/timeline/TimelineGrid";

/**
 * M2 스켈레톤. 아직 데이터가 없으므로(M1 대기) 셀은 비어 있고, 검증 대상은
 * 축 자체다 — 스크롤 컨테이너·스페이서·연도 거터·가상화·줌 앵커·시대 레일.
 */
export default function Page() {
  return <TimelineGrid />;
}
