import { describe, expect, it } from "vitest";

import { ALREADY_SHORT, NAME_MAX, validName } from "./name-rules.mjs";

/**
 * 지은 제목의 마지막 관문. 이 검증기가 무른 만큼 화면에 이상한 제목이 남는다.
 *
 * 설계 전제: **틀린 제목은 긴 문장보다 나쁘다.** 그래서 의심스러우면 버린다 —
 * 버려진 줄은 원문 문장을 그대로 쓰므로 손실이 아니라 원상 복귀다.
 * 여기 있는 경우들은 전부 실제 실행에서 나온 것이다(2026-09-12, 8,008줄).
 */
describe("validName", () => {
  it("평범한 명사구는 통과한다", () => {
    expect(validName("2·8 독립선언", "2월. 14개조 평화 원칙에서…", 1919)).toBe("2·8 독립선언");
    expect(validName("조일해저전선부설조약", "3월. 조일해저전선부설조약이…", 1883)).toBe("조일해저전선부설조약");
  });

  it("끝의 마침표를 떼고, 앞뒤 공백을 다듬는다", () => {
    expect(validName("  진주만 공격.  ", "…", 1941)).toBe("진주만 공격");
  });

  it("서술어로 끝나면 버린다 — 그것은 제목이 아니라 문장이다", () => {
    for (const bad of ["조선이 그레고리력을 사용하기 시작했다", "왕이 즉위하다", "성이 함락되었다"]) {
      expect(validName(bad, "…", 1896)).toBeNull();
    }
  });

  it("그 사건의 연도가 앞에 붙으면 떼어 낸다 — 연도는 시간축에 이미 있다", () => {
    // 실제로 4건이 이 꼴로 버려졌다. 미국 대선처럼 관용 명칭에 연도가 붙는 사건이 있다
    expect(validName("1940년 미국 대선", "…", 1940)).toBe("미국 대선");
  });

  it("다른 연도가 붙어 있으면 버린다 — 모델이 엉뚱한 줄을 본 것이다", () => {
    expect(validName("1940년 미국 대선", "…", 1944)).toBeNull();
  });

  it("연도 말고 다른 날짜가 남아 있으면 버린다", () => {
    expect(validName("12월 7일 기습", "…", 1941)).toBeNull();
  });

  it("너무 짧거나 너무 길면 버린다", () => {
    expect(validName("난", "…", 1000)).toBeNull();
    expect(validName("가".repeat(NAME_MAX + 1), "…", 1000)).toBeNull();
    expect(validName("가".repeat(NAME_MAX), "…", 1000)).toHaveLength(NAME_MAX);
  });

  it("원문을 그대로 되받아쓴 것은 버린다", () => {
    expect(validName("임진왜란 발발", "임진왜란 발발", 1592)).toBeNull();
  });

  it("문자열이 아니면 버린다 — 모델이 null을 낼 수 있다", () => {
    expect(validName(null, "…", 1000)).toBeNull();
    expect(validName(undefined, "…", 1000)).toBeNull();
    expect(validName(42, "…", 1000)).toBeNull();
  });

  it("연도를 주지 않아도 동작한다 — 연도 접두만 못 뗀다", () => {
    expect(validName("미국 대선", "…")).toBe("미국 대선");
    expect(validName("1940년 미국 대선", "…")).toBeNull();
  });
});

describe("상수", () => {
  it("이미 짧은 줄의 기준이 이름 상한보다 작다 — 안 그러면 지은 이름이 다시 '짧은 줄'로 걸린다", () => {
    expect(ALREADY_SHORT).toBeLessThanOrEqual(NAME_MAX);
  });
});
