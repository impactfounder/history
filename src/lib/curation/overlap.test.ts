import { describe, expect, it } from "vitest";
import { checkOverlap, longestCommonRun, tokenize } from "./overlap.mjs";

// editorial-policy §1-6의 강제 장치. 사람 눈으로만 거르면 3,000건에서 반드시
// 샌다는 전제로, 기계가 잡아야 하는 것과 잡으면 안 되는 것을 고정한다.

const 원문 =
  "1592년 4월 13일, 도요토미 히데요시가 조선을 침략하여 임진왜란이 시작되었다. " +
  "부산진과 동래성이 차례로 함락되었고 선조는 의주로 피난하였다.";

describe("tokenize", () => {
  it("각주·괄호 병기·문장부호를 떼고 어절로 나눈다", () => {
    expect(tokenize("임진왜란(壬辰倭亂)[1]이 일어났다.")).toEqual(["임진왜란이", "일어났다"]);
  });

  it("숫자와 연도는 남긴다 — 빼면 베끼기가 안 보인다", () => {
    expect(tokenize("1592년 조선을 침략")).toEqual(["1592년", "조선을", "침략"]);
  });
});

describe("longestCommonRun", () => {
  it("가장 긴 연속 구간을 돌려준다", () => {
    const a = tokenize("가 나 다 라 마 바");
    const b = tokenize("하 나 다 라 마 자");
    expect(longestCommonRun(a, b).tokens).toEqual(["나", "다", "라", "마"]);
  });

  it("겹치는 게 없으면 길이 0", () => {
    expect(longestCommonRun(tokenize("가 나"), tokenize("다 라")).length).toBe(0);
  });

  it("빈 입력에서 터지지 않는다", () => {
    expect(longestCommonRun([], tokenize("가")).length).toBe(0);
    expect(longestCommonRun(tokenize("가"), []).length).toBe(0);
  });
});

describe("checkOverlap — 막아야 하는 것", () => {
  it("원문 문장을 그대로 옮기면 반려한다", () => {
    const r = checkOverlap(원문, "도요토미 히데요시가 조선을 침략하여 임진왜란이 시작되었다.");
    expect(r.ok).toBe(false);
    expect(r.run.length).toBeGreaterThanOrEqual(6);
  });

  it("어절만 살짝 섞어도 겹침 비율에서 걸린다", () => {
    const r = checkOverlap(
      원문,
      "부산진과 동래성이 함락되었고 선조는 의주로 피난하였다 조선을 침략하여",
    );
    expect(r.ok).toBe(false);
  });

  it("반려 사유를 사람이 읽을 수 있게 낸다", () => {
    const r = checkOverlap(원문, "부산진과 동래성이 차례로 함락되었고 선조는 의주로 피난하였다.");
    expect(r.reasons.join(" ")).toMatch(/연속 \d+어절 일치/);
  });
});

describe("checkOverlap — 통과시켜야 하는 것", () => {
  it("사실에서 새로 쓴 요약은 통과한다", () => {
    // 연도·주체·결과만 남기고 문장 구조를 새로 짠 경우
    const r = checkOverlap(원문, "일본이 조선을 침공해 7년 전쟁이 시작된 해.");
    expect(r.ok).toBe(true);
  });

  it("고유명사가 겹치는 것만으로는 반려하지 않는다", () => {
    const r = checkOverlap(원문, "임진왜란 발발. 선조는 수도를 떠났다.");
    expect(r.ok).toBe(true);
  });

  it("짧은 요약에서 우연히 두세 어절 겹치는 것은 허용한다", () => {
    const r = checkOverlap(원문, "도요토미 히데요시의 조선 침공.");
    expect(r.run.length).toBeLessThan(6);
    expect(r.ok).toBe(true);
  });
});

describe("checkOverlap — 임계값", () => {
  it("임계값을 낮추면 더 깐깐해진다", () => {
    // ratio도 함께 풀어야 run 임계값만 격리해서 볼 수 있다 — 원문에서 그대로
    // 떼어 온 조각은 겹침 비율이 100%라 그쪽에서도 걸린다.
    const opts = { maxRatio: 1 };
    const loose = checkOverlap(원문, "부산진과 동래성이 차례로 함락되었고", { ...opts, maxRun: 10 });
    const tight = checkOverlap(원문, "부산진과 동래성이 차례로 함락되었고", { ...opts, maxRun: 3 });
    expect(loose.ok).toBe(true);
    expect(tight.ok).toBe(false);
  });

  it("빈 요약문은 겹침이 없으므로 통과한다 — 내용 검사는 다른 층의 일이다", () => {
    expect(checkOverlap(원문, "").ok).toBe(true);
  });
});
