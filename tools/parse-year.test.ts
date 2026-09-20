import { describe, expect, it } from "vitest";

import { parseYear } from "./parse-year.mjs";

/**
 * 연도 파싱은 **오탐 판정의 1차 관문**이다. 여기서 틀리면 성수대교가 서기 21년에 놓인다.
 * 아래 경우들은 전부 실제 수집에서 한 번씩 틀렸던 것이고, 파일 주석에 그 날짜가 적혀 있다.
 * `null`을 돌려주면 수집기가 **앞 행의 연도를 물려받으므로**, "못 읽음"은 조용한 오류가 된다.
 */
const y = (t: string) => parseYear(t)?.year ?? null;

describe("영어", () => {
  it("평범한 연도와 BC", () => {
    expect(y("1592")).toBe(1592);
    expect(parseYear("300 BC")).toMatchObject({ year: -299, era: "bc" });
  });

  it("c. 는 근사다", () => {
    expect(parseYear("c. 1500")).toMatchObject({ year: 1500, approximate: true });
  });

  it("물결도 근사다 — AI 연표가 이 표기를 쓴다(2026-09-20)", () => {
    expect(parseYear("~1500 — Paracelsus claimed…")).toMatchObject({ year: 1500, approximate: true });
    expect(parseYear("~800 — Jabir ibn Hayyan…")).toMatchObject({ year: 800, approximate: true });
  });

  /**
   * 서수 세기. 이게 없으면 "3rd"의 r이 일반 숫자 규칙의 \b를 막아 null이 되고,
   * null은 앞 행의 연도를 물려받는다 — 헤론(1세기)과 크테시비오스(기원전 3세기)가
   * 아리스토텔레스와 같은 기원전 383년에 놓였다(2026-09-20 AI 열 첫 수집).
   */
  it("서수 세기 — 대소문자와 BC를 가린다", () => {
    expect(parseYear("3rd century BC — Ctesibius…")).toMatchObject({ year: -249, precision: "century", era: "bc" });
    expect(parseYear("1st century — Hero of Alexandria…")).toMatchObject({ year: 50, precision: "century", era: "ad" });
    expect(parseYear("9th Century — The Banū Mūsā…")).toMatchObject({ year: 850, precision: "century" });
  });

  it("연도 범위는 시작 연도를 쓴다", () => {
    expect(y("384 BC–322 BC")).toBe(-383);
  });
});

describe("한국어", () => {
  it("세기 규칙이 BC 규칙보다 먼저다 — 'BC.4세기'의 4를 연도로 먹으면 안 된다(파일럿 #8)", () => {
    expect(parseYear("BC.4세기경")).toMatchObject({ year: -349, precision: "century", era: "bc" });
  });

  it("연·기원전·만 단위", () => {
    expect(y("1592년")).toBe(1592);
    expect(y("기원전 500년")).toBe(-499);
    expect(y("BC.70만")).toBe(-699999);
  });
});

describe("한자권", () => {
  it("세기·기원전·연호", () => {
    expect(parseYear("前3世紀")).toMatchObject({ year: -249, precision: "century", era: "bc" });
    expect(y("607年")).toBe(607);
    expect(y("1159年（平治元年）")).toBe(1159);
  });

  it("1960年代는 십년이다 — 1960을 연도로 읽으면 안 된다", () => {
    expect(parseYear("1960年代")).toMatchObject({ precision: "decade" });
  });

  it("기간 표현은 연도가 아니다 — '3年間'이 서기 3년이 됐다(2026-09-05)", () => {
    expect(parseYear("3年間弱に及ぶ民主党中心の政権が…")).toBeNull();
  });

  it("줄 앞의 목록 번호를 연도로 읽지 않는다 — '1 大化'가 서기 1년이 됐다(2026-09-05)", () => {
    expect(parseYear("1 大化 (645年-650年)")).toBeNull();
  });
});

describe("읽지 못하면 null", () => {
  it("연도가 없는 줄", () => {
    expect(parseYear("al-Khwarizmi wrote textbooks with precise steps")).toBeNull();
    expect(parseYear("")).toBeNull();
  });
});
