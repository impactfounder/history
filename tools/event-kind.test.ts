import { describe, expect, it } from "vitest";

import { EVENT_TYPES, NON_EVENT_TYPES, isEventLike, isPersonOrPlace } from "./event-kind.mjs";

/**
 * **QID가 「사건」인가.** 이 판정 하나를 `derive.mjs`의 중요도 점수와 `publish.mjs`의 교차 사건
 * 묶기가 **함께** 쓴다. 두 벌이 되면 "중요도는 사건으로 보는데 교차는 아니라고 보는" 상태가 된다.
 *
 * 틀렸을 때 벌어지는 일(둘 다 실측):
 *  · 중요도 — 「불교」·「철기 시대」가 언어판 200개를 업고 세기 레벨에 올라온다(2026-09-05)
 *  · 교차 — 「고구려」 QID가 **기원전 36년 건국과 668년 멸망을 한 사건으로 묶는다**.
 *    2열 이상에 걸친 QID 98개 중 **40개**가 이런 나라·개념이었다(2026-09-21).
 */
const facts = {
  Q_battle: { types: ["Q178561"] }, // 전투
  Q_person: { human: true },
  Q_country: { types: ["Q6256"] },
  Q_concept: { types: ["Q_something_else"] },
  Q_sea: { types: ["Q9430"] },
};

describe("isEventLike — 이름이 사건 꼴이거나 유형이 사건", () => {
  it("P31이 사건 유형이면 사건", () => {
    expect(isEventLike({ qid: "Q_battle", names_native: { en: "Somewhere" } }, facts)).toBe(true);
  });

  it("이름이 사건 꼴이면 유형을 안 봐도 사건", () => {
    expect(isEventLike({ qid: "Q_country", names_native: { ko: "임진왜란" } }, facts)).toBe(true);
  });

  /** 여기가 교차 사건이 무너지던 자리다 — 나라 이름은 사건이 아니다. */
  it.each([
    ["나라", "Q_country", { ko: "고구려" }],
    ["사람", "Q_person", { ko: "세종" }],
    ["바다", "Q_sea", { ko: "동해" }],
  ])("%s는 사건이 아니다", (_, qid, names) => {
    expect(isEventLike({ qid, names_native: names }, facts)).toBe(false);
  });

  it("qid도 이름도 없으면 사건이 아니다", () => {
    expect(isEventLike({}, facts)).toBe(false);
    expect(isEventLike({ qid: "Q_missing" }, facts)).toBe(false);
    expect(isEventLike(undefined as never, facts)).toBe(false);
  });

  it("facts가 없어도 던지지 않는다 — 캐시가 비어 있을 수 있다", () => {
    expect(isEventLike({ qid: "Q_battle" }, undefined as never)).toBe(false);
  });
});

describe("isPersonOrPlace — 중요도에서 가장 세게 눌리는 쪽", () => {
  it.each([
    ["사람", "Q_person"],
    ["나라", "Q_country"],
    ["바다", "Q_sea"],
  ])("%s", (_, qid) => {
    expect(isPersonOrPlace({ qid }, facts)).toBe(true);
  });

  it("전투는 아니다", () => {
    expect(isPersonOrPlace({ qid: "Q_battle" }, facts)).toBe(false);
  });

  /** 개념(불교·컴퓨터)은 사람도 사건도 아니다 — 가중치 0.3을 받는 가운데 칸이다. */
  it("개념은 둘 다 아니다", () => {
    expect(isEventLike({ qid: "Q_concept" }, facts)).toBe(false);
    expect(isPersonOrPlace({ qid: "Q_concept" }, facts)).toBe(false);
  });
});

describe("표가 비어 있지 않다", () => {
  it("두 표 모두 항목이 있다", () => {
    expect(EVENT_TYPES.size).toBeGreaterThan(20);
    expect(NON_EVENT_TYPES.size).toBeGreaterThan(20);
  });

  it("같은 QID가 양쪽에 있지 않다 — 있으면 판정이 자기모순이다", () => {
    const both = [...EVENT_TYPES].filter((q) => NON_EVENT_TYPES.has(q));
    expect(both).toEqual([]);
  });
});
