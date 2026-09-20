import { describe, expect, it } from "vitest";

import { decodeYears, isEmptyRange, nearestYears } from "./gap";

/**
 * 빈 구간 힌트의 계산. 틀리면 **없는 해를 가리키는 안내**가 뜬다 — 눌러도 아무것도 없는
 * 해로 데려가므로, 잘못된 힌트는 없는 것보다 나쁘다.
 */
describe("decodeYears — 델타를 되돌린다", () => {
  it("누적합이다", () => {
    expect(decodeYears([1592, 6, 2])).toEqual([1592, 1598, 1600]);
  });

  it("기원전도 된다 — 첫 값이 음수다", () => {
    expect(decodeYears([-499, 1, 100])).toEqual([-499, -498, -398]);
  });

  it("빈 목록", () => {
    expect(decodeYears([])).toEqual([]);
  });
});

describe("nearestYears — 앞뒤로 가장 가까운 해", () => {
  const ys = [-400, 1, 918, 1392, 1592, 1948, 2022];

  it.each([
    [1000, 918, 1392],
    [1500, 1392, 1592],
    [0, -400, 1],
    [2000, 1948, 2022],
  ])("%i → 앞 %i · 뒤 %i", (y, prev, next) => {
    expect(nearestYears(ys, y)).toEqual({ prev, next });
  });

  it("맨 앞보다 이르면 앞이 없다", () => {
    expect(nearestYears(ys, -499)).toEqual({ prev: null, next: -400 });
  });

  it("맨 뒤보다 늦으면 뒤가 없다", () => {
    expect(nearestYears(ys, 2026)).toEqual({ prev: 2022, next: null });
  });

  /**
   * 그 해에 사건이 있어도 **그것은 답이 아니다.** 힌트는 빈 해에서만 뜨고, "여기 말고 어디"를
   * 묻는 것이다. 자기 자신을 가리키면 눌러도 제자리다.
   */
  it("자기 해는 답이 아니다", () => {
    expect(nearestYears(ys, 1592)).toEqual({ prev: 1392, next: 1948 });
  });

  it("빈 색인이면 둘 다 없다", () => {
    expect(nearestYears([], 1000)).toEqual({ prev: null, next: null });
  });

  it("한 해만 있는 열", () => {
    expect(nearestYears([1948], 1000)).toEqual({ prev: null, next: 1948 });
    expect(nearestYears([1948], 2000)).toEqual({ prev: 1948, next: null });
  });
});

describe("isEmptyRange — 볼 것이 있으면 잔소리하지 않는다", () => {
  const ys = [918, 1392, 1592, 1948];

  it("구간 안에 하나라도 있으면 비어 있지 않다", () => {
    expect(isEmptyRange(ys, 1580, 1600)).toBe(false);
    expect(isEmptyRange(ys, 1592, 1592)).toBe(false); // 한 해짜리 구간
  });

  it("구간 안에 없으면 비어 있다", () => {
    expect(isEmptyRange(ys, 1600, 1700)).toBe(true);
    expect(isEmptyRange(ys, 1949, 2026)).toBe(true);
    expect(isEmptyRange(ys, -499, 900)).toBe(true);
  });

  it("경계를 포함한다", () => {
    expect(isEmptyRange(ys, 1392, 1500)).toBe(false); // 왼쪽 끝
    expect(isEmptyRange(ys, 1300, 1392)).toBe(false); // 오른쪽 끝
    expect(isEmptyRange(ys, 1393, 1591)).toBe(true); // 사이
  });

  it("색인이 비면 늘 비어 있다", () => {
    expect(isEmptyRange([], 1000, 2000)).toBe(true);
  });
});
