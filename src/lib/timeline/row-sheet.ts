/**
 * 행 시트(PRD §5-7)의 열 순서 — 컴포넌트 밖에 둬 테스트한다(이 레포에는 jsdom이 없다).
 *
 *   1) 격자에 보이는 열이 먼저, 그다음 격자 밖 열 — 폰은 2열이라 나머지는 시트에서만 보인다.
 *   2) 그 순서를 지키되 **빈 열은 끝으로** — 반 높이 시트의 첫 자리를 「수록 사건 없음」이 차지하지 않게.
 *      아직 청크가 안 온 열은 비었는지 모르므로 제자리에 둔다.
 */
export function rowSheetRegions<R extends string>(visible: readonly R[], all: readonly R[]): R[] {
  return [...visible, ...all.filter((id) => !visible.includes(id))];
}

export function orderRowGroups<G extends { loading: boolean; total: number }>(groups: readonly G[]): G[] {
  const empty = (g: G) => (!g.loading && g.total === 0 ? 1 : 0);
  return [...groups].sort((a, b) => empty(a) - empty(b)); // 안정 정렬 — 같은 무리 안의 순서는 그대로
}
