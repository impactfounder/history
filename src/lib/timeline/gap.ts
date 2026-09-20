/**
 * **빈 구간에서 다음 사건이 어디인지.** PRD §5-4·§4-1이 적어 둔 「다음 사건 1392년 ↓ ·
 * 이전 사건 1356년 ↑」 힌트의 계산. **M2 완료 조건**인데 0건이었다.
 *
 * 왜 필요한가 — 실측(2026-09-20): 십년 버킷 253칸 중 덮인 칸이
 * **AI 39(15%) · 미국 43(17%)** 이다. 다섯 열 중 둘은 대부분의 화면이 비어 있고, 사용자는
 * **다음 사건이 어디인지 알 길 없이** 스크롤하거나 줌아웃해야 했다.
 * (cn 250 · kr 201 · jp 181은 사정이 낫다.)
 *
 * ── 왜 청크로는 안 되는가 ──────────────────────────────────────────────────
 * "다음 사건은 1392년"이라고 말하려면 **그 해를 알아야** 하는데, 청크는 보이는 구간만 게을리
 * 받는다. 빈 구간에서는 받을 청크가 없으니 아무것도 모른다. 그래서 열별로 **사건이 있는 해**만
 * 추린 색인을 따로 받는다.
 *
 * 크기가 문제되지 않는다 — 다섯 열 합쳐 3,711개 해이고 **델타 인코딩하면 gzip 1.3KB**다
 * (그대로는 5.3KB). 첫 로드에 얹어도 부담이 없고, 그래야 힌트가 첫 화면부터 정확하다.
 */

/** 발행 포맷: 열 → 앞 값과의 차이. 오름차순 연도 배열을 그대로 싣는 것보다 4배 작다. */
export type YearIndexFile = { years: Record<string, number[]> };

/** 델타를 되돌려 오름차순 연도 배열로. */
export function decodeYears(delta: readonly number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const d of delta) {
    prev += d;
    out.push(prev);
  }
  return out;
}

/**
 * `years`에서 `year`보다 **앞선 마지막 해**와 **뒤따르는 첫 해**. 없으면 `null`.
 * `year` 자체에 사건이 있어도 그것은 답이 아니다 — 힌트는 **빈 해에서만** 뜨고,
 * "여기 말고 어디"를 묻는 것이기 때문이다.
 *
 * `years`는 오름차순이라고 가정한다(발행이 그렇게 낸다). 이분 탐색이라 3,711개여도 12번이면 끝난다.
 */
export function nearestYears(years: readonly number[], year: number): { prev: number | null; next: number | null } {
  if (!years.length) return { prev: null, next: null };
  // year 이상인 첫 자리
  let lo = 0;
  let hi = years.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (years[mid]! < year) lo = mid + 1;
    else hi = mid;
  }
  const prev = lo > 0 ? years[lo - 1]! : null;
  // lo가 year 자신을 가리킬 수 있다 — 그때는 그다음이 「다음 사건」이다
  const nextIdx = years[lo] === year ? lo + 1 : lo;
  const next = nextIdx < years.length ? years[nextIdx]! : null;
  return { prev, next };
}

/**
 * 보이는 구간 `[from, to]`에 이 열의 사건이 하나도 없는가.
 * 하나라도 있으면 힌트를 띄우지 않는다 — 볼 것이 있는데 "다음은 저기"라고 말하면 잔소리다.
 */
export function isEmptyRange(years: readonly number[], from: number, to: number): boolean {
  const { next } = nearestYears(years, from - 1);
  return next === null || next > to;
}
