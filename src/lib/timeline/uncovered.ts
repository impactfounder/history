/**
 * **미수록 구간(PRD §11 C-3)** — 행 하나 중 수록 시작 전인 비율. 격자가 그만큼 빗금을 깐다.
 *
 * 미국 열의 1500년은 비어 있다. 그것은 버그가 아니라 답이다 — 다만 사용자가 「일이 없었다」와
 * 「아직 수록하지 않았다」를 구별할 수 있어야 한다. 경계가 걸친 행은 **걸친 만큼만** 칠한다:
 * 세기 행 1600–1700은 위 7%(1600–1607), 십년 행 1600–1610은 위 70%.
 *
 * @param rowStart 행의 시작 연도(버킷 시작)
 * @param unit     행 하나의 연수(세기 100 · 십년 10 · 연도 1)
 * @param coverageFrom 열의 수록 시작 연도. 없으면 축 전체를 수록한 열이다
 * @returns 0(전부 수록) ~ 1(전부 미수록)
 */
export function uncoveredFraction(rowStart: number, unit: number, coverageFrom: number | undefined): number {
  if (coverageFrom == null || unit <= 0 || rowStart >= coverageFrom) return 0;
  return Math.min(1, (coverageFrom - rowStart) / unit);
}
