import { describe, expect, it } from "vitest";

import { assignLanes, baseTier, MAX_LANES, RANK_MIN_N, tierOf, type Tier } from "./rank";

const N = 100; // 백분위가 그대로 인덱스가 되도록

describe("baseTier — 오늘의 tone 삼항과 같은 경계", () => {
  it("5는 1, 4는 2, 3 이하는 3", () => {
    expect(baseTier(5)).toBe(1);
    expect(baseTier(4)).toBe(2);
    for (const imp of [3, 2, 1]) expect(baseTier(imp)).toBe(3);
  });
});

describe("tierOf — 순위는 강등만 시킨다", () => {
  it("순위가 좋아도 중요도보다 위로 올라가지 않는다", () => {
    // imp 2(=base 3)가 청크 맨 앞(pct 0)이어도 3에 머문다.
    expect(tierOf(2, 0, N)).toBe(3);
    expect(tierOf(3, 0, N)).toBe(3);
    // imp 4(=base 2)가 맨 앞이어도 1이 되지 않는다.
    expect(tierOf(4, 0, N)).toBe(2);
  });

  it("순위가 나쁘면 강등된다 — 세기 붕괴를 푸는 지점", () => {
    // 세기 청크는 전부 imp 5다. 오늘은 전부 같은 두꺼운 카드가 된다.
    expect(tierOf(5, 0, N)).toBe(1); // 상위
    expect(tierOf(5, 20, N)).toBe(2); // 중위
    expect(tierOf(5, 60, N)).toBe(3); // 하위
  });

  it("모든 입력에서 base보다 가벼워지기만 한다(단조성)", () => {
    for (const imp of [1, 2, 3, 4, 5]) {
      for (let i = 0; i < N; i++) {
        expect(tierOf(imp, i, N)).toBeGreaterThanOrEqual(baseTier(imp));
      }
    }
  });

  it("등급은 인덱스에 대해 단조 증가한다(뒤로 갈수록 가볍다)", () => {
    let prev: Tier = 1;
    for (let i = 0; i < N; i++) {
      const t = tierOf(5, i, N);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});

describe("tierOf — 작은 청크 폴백", () => {
  it(`건수가 ${RANK_MIN_N} 미만이면 순위를 쓰지 않는다(오늘 화면 유지)`, () => {
    const n = RANK_MIN_N - 1;
    for (const imp of [1, 3, 4, 5]) {
      for (let i = 0; i < n; i++) expect(tierOf(imp, i, n)).toBe(baseTier(imp));
    }
  });

  it("3건짜리 청크에서 맨 앞 사건이 승격되지 않는다", () => {
    // "사건이 적다"가 "그 사건이 중요하다"를 뜻하지 않는다 — 빈 셀 원칙의 형제.
    expect(tierOf(2, 0, 3)).toBe(3);
  });

  it("경계값에서 순위가 켜진다", () => {
    expect(tierOf(5, 60, RANK_MIN_N - 1)).toBe(1); // 아직 base만
    expect(tierOf(5, RANK_MIN_N - 1, RANK_MIN_N)).toBe(3); // 순위 적용
  });
});

describe("tierOf — 실측 청크 재현", () => {
  it("세기·kr 1900행(sl 150 132 88 88 72 52 45)이 1,1,1,1,1,2,2로 갈린다", () => {
    // 세기 청크 kr은 91건이고 이 7건이 그 안에서 상위에 몰려 있다.
    const n = 91;
    const idx = [0, 1, 2, 3, 4, 12, 13];
    const got = idx.map((i) => tierOf(5, i, n));
    expect(got).toEqual([1, 1, 1, 1, 1, 2, 2]);
  });

  it("한 청크 안에서 세 등급이 모두 나온다 — 대비 0이 아니게 된다", () => {
    const n = 91;
    const tiers = new Set(Array.from({ length: n }, (_, i) => tierOf(5, i, n)));
    expect(tiers).toEqual(new Set([1, 2, 3]));
  });
});


describe("assignLanes — 겹치는 기간 쌓기", () => {
  it("겹치지 않으면 전부 0번 레인을 재사용한다", () => {
    expect(assignLanes([{ top: 0, bottom: 10 }, { top: 10, bottom: 20 }, { top: 30, bottom: 40 }])).toEqual([0, 0, 0]);
  });

  it("겹치면 다음 레인으로 밀린다", () => {
    expect(assignLanes([{ top: 0, bottom: 100 }, { top: 10, bottom: 50 }, { top: 20, bottom: 30 }])).toEqual([0, 1, 2]);
  });

  it("레인이 다 차면 -1 — 프레임을 포기하고 텍스트로 떨어진다", () => {
    const spans = Array.from({ length: 6 }, (_, i) => ({ top: i, bottom: 100 }));
    expect(assignLanes(spans)).toEqual([0, 1, 2, -1, -1, -1]);
  });

  it("실측 최대 겹침(13개)에서도 상한을 넘지 않는다", () => {
    const spans = Array.from({ length: 13 }, (_, i) => ({ top: i, bottom: 200 }));
    const lanes = assignLanes(spans);
    expect(Math.max(...lanes)).toBeLessThan(MAX_LANES);
    expect(lanes.filter((l) => l === -1)).toHaveLength(10);
  });

  it("레인이 비면 다시 쓴다", () => {
    expect(assignLanes([{ top: 0, bottom: 10 }, { top: 1, bottom: 20 }, { top: 12, bottom: 30 }])).toEqual([0, 1, 0]);
  });

  it("결정적이다 — 같은 입력에 같은 출력", () => {
    const spans = [{ top: 0, bottom: 50 }, { top: 10, bottom: 60 }, { top: 55, bottom: 70 }];
    expect(assignLanes(spans)).toEqual(assignLanes(spans));
  });
});
