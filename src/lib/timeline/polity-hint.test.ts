import { describe, expect, it } from "vitest";

import { emptyPolityHint, polityInRow } from "./polity-hint";

const 삼국 = { id: "samguk", y0: -57, y1: 660 };
const 남북국 = { id: "nambuk", y0: 660, y1: 918 };
const 고려 = { id: "goryeo", y0: 918, y1: 1392 };
const kr = [삼국, 남북국, 고려];
const END = 2026;

/** 가장 줄인 화면의 한국 열 — 100·200년대가 빈 칸이다(2026-09-26 스크린샷) */
const empty = (set: number[]) => (b: number) => set.includes(b);

describe("polityInRow", () => {
  it("행에 걸친 정치체", () => {
    expect(polityInRow(kr, 100, 100)).toBe(삼국);
  });
  it("둘이 걸치면 늦게 시작한 쪽 — 600년대는 남북국", () => {
    expect(polityInRow(kr, 600, 100)).toBe(남북국);
  });
  it("끝난 해는 포함하지 않는다(y1은 배타)", () => {
    expect(polityInRow([삼국], 660, 10)).toBeUndefined();
  });
  it("진행 중(y1 null)", () => {
    expect(polityInRow([{ y0: 1948, y1: null }], 2000, 100)).toEqual({ y0: 1948, y1: null });
  });
  it("정치체가 없는 열(AI)", () => {
    expect(polityInRow(undefined, 100, 100)).toBeUndefined();
  });
});

describe("emptyPolityHint", () => {
  it("빈 칸 줄의 첫 칸에만 이름을 쓴다", () => {
    const isEmpty = empty([100, 200]);
    expect(emptyPolityHint(kr, 100, 100, isEmpty, END)).toBe(삼국);
    expect(emptyPolityHint(kr, 200, 100, isEmpty, END)).toBeUndefined();
  });
  it("정치체마다 첫 빈 칸에 한 번 — 사건 사이 빈 칸마다 되풀이하지 않는다(십년 보기 180·230·250년대)", () => {
    const isEmpty = empty([180, 230, 250]);
    expect(emptyPolityHint(kr, 180, 10, isEmpty, END)).toBe(삼국);
    expect(emptyPolityHint(kr, 230, 10, isEmpty, END)).toBeUndefined();
    expect(emptyPolityHint(kr, 250, 10, isEmpty, END)).toBeUndefined();
  });
  it("사건이 있는 칸에는 쓰지 않는다", () => {
    expect(emptyPolityHint(kr, 400, 100, empty([100]), END)).toBeUndefined();
  });
  it("위 칸이 비어 있어도 정치체가 바뀌었으면 다시 쓴다", () => {
    const isEmpty = empty([500, 600]);
    expect(emptyPolityHint(kr, 600, 100, isEmpty, END)).toBe(남북국);
  });
  it("아직 안 받은 칸(isEmpty false)에는 쓰지 않는다 — 로딩 깜빡임 방지", () => {
    expect(emptyPolityHint(kr, 100, 100, () => false, END)).toBeUndefined();
  });
  it("수록 끝 뒤의 행에는 쓰지 않는다 — 2100년대 빈 칸에 「대한민국」을 적지 않는다", () => {
    const 대한민국 = { id: "rok", y0: 1948, y1: null };
    expect(emptyPolityHint([대한민국], 2100, 100, () => true, END)).toBeUndefined();
    expect(emptyPolityHint([대한민국], 2020, 10, empty([2020]), END)).toBe(대한민국);
  });
  it("정치체가 없는 열에는 쓰지 않는다", () => {
    expect(emptyPolityHint(undefined, 100, 100, () => true, END)).toBeUndefined();
  });
});
