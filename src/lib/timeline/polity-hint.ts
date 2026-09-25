/**
 * 빈 칸의 정치체 이름 — 사건이 없는 칸에 「그때 거기에 무엇이 있었나」만 적는다(2026-09-26).
 *
 * 대표 지적: 가장 줄인 화면에서 한국 열 100–300년대가 통째로 비어 있었다. 이름은 열 머리가 맡지만
 * 머리는 **화면 맨 위 연도의 것 하나**만 보여 주므로, 아래쪽 빈 칸은 무슨 시대인지 말해 주는 것이
 * 아무것도 없었다. 괄호(러그·틱)는 「언제 바뀌었나」만 그린다.
 *
 * 규칙:
 *  - **빈 칸에만** 쓴다 — 칩이 있는 칸에 얹으면 사건과 겹치고, 사건처럼 읽힌다.
 *  - **정치체마다 시작 뒤 첫 빈 칸에 한 번만** 쓴다. 처음 판은 「빈 칸 줄의 첫 칸」이었는데, 십년 보기에서
 *    사건 사이 빈 칸마다 「삼국 시대」가 다시 찍혔다(180·230·250년대 — 열 머리도 같은 이름을 말하고 있었다).
 *    이름이 필요한 곳은 **왕조가 바뀐 자리**다. 시작이 화면 위에 있으면 열 머리가 그 이름을 댄다.
 *  - 행에 정치체가 둘 걸치면 **늦게 시작한 쪽** — 그 행 안의 「지금」에 가깝다.
 *  - **수록 끝 뒤의 행에는 쓰지 않는다** — 축은 2300년대까지 그리는데, 2100년대 빈 칸에 「대한민국」을
 *    적으면 아직 오지 않은 시대를 적은 것이 된다(첫 판에서 실제로 떴다).
 *
 * 순수 함수. DOM 접근 0.
 */

export interface Band {
  y0: number;
  /** null = 진행 중 */
  y1: number | null;
}

/** 행 `[b, b + unit)`에 걸친 정치체 중 가장 늦게 시작한 것. */
export function polityInRow<P extends Band>(list: readonly P[] | undefined, b: number, unit: number): P | undefined {
  let best: P | undefined;
  for (const p of list ?? []) {
    if (p.y0 < b + unit && (p.y1 == null || p.y1 > b) && (!best || p.y0 > best.y0)) best = p;
  }
  return best;
}

/**
 * 이 칸에 적을 정치체. 없으면 undefined.
 * @param isEmpty 그 행이 **받은 뒤에** 비어 있는가. 아직 안 받은 칸은 false여야 한다 — 로딩 중에 이름이
 *                떴다가 사건이 오면 사라지는 깜빡임이 생긴다.
 * @param end 수록 끝 연도(axis.ts AXIS_YEAR_END — year-data.ts DATA_END_YEAR와 같은 값, 그쪽은 서버 전용). 행의 시작이 이보다 뒤면 쓰지 않는다.
 */
export function emptyPolityHint<P extends Band>(
  list: readonly P[] | undefined,
  b: number,
  unit: number,
  isEmpty: (b: number) => boolean,
  end: number,
): P | undefined {
  if (b > end || !isEmpty(b)) return undefined;
  const p = polityInRow(list, b, unit);
  if (!p) return undefined;
  // 이 정치체가 시작한 뒤 이미 빈 칸이 있었으면 거기서 이름을 댔다. 안 받은 칸은 isEmpty가 false라 건너뛴다
  for (let x = b - unit; x + unit > p.y0; x -= unit) {
    if (isEmpty(x) && polityInRow(list, x, unit) === p) return undefined;
  }
  return p;
}
