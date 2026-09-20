import { describe, expect, it } from "vitest";

import { textEndYear } from "./text-range.mjs";

/**
 * 기간 막대의 근거. 틀리면 화면에 **없는 기간**이 그려진다 — 3px 실선이던 시절에는 묻혔지만
 * 1b에서 지속이 주 채널(프레임)이 되면서 전면에 뜬다.
 *
 * 아래 경우는 전부 실제 발행 데이터에서 왔다(2026-09-20 실측, 원문 범위로 잡힌 기간 56건).
 * 52건은 맞았고 4건이 틀렸다. 틀린 넷이 아래 "버린다" 절이다.
 */
describe("사건 이름 뒤의 기간은 그 사건의 것이다", () => {
  it.each([
    ["Song-Xia War (1040–1044): Western Xia invades Song", 1040, 1044],
    ["White Lotus Rebellion (1795–1806)", 1795, 1806],
    ["La Matanza (1910–1920)", 1910, 1920],
    ["McCarthyism (1950–1954) begins in the United States", 1950, 1954],
    ["1914年：第一次世界大戰（1914-1918）爆发。9月日本军队…", 1914, 1918],
    ["1950年：朝鮮戰爭（1950-1953）爆發，美國派遣第七艦隊…", 1950, 1953],
  ])("%s", (text, year, end) => {
    expect(textEndYear(text, year)).toBe(end);
  });

  it("줄 앞머리의 범위도 그 줄의 것이다", () => {
    expect(textEndYear("1412–1414: Namdaemun Market, now the oldest…", 1412)).toBe(1414);
    expect(textEndYear("1811~1812년 뉴매드리드 지진", 1811)).toBe(1812);
  });

  it("시작이 한 해 어긋나는 것까지는 받는다 — 연표가 해를 달리 잡는 일이 있다", () => {
    expect(textEndYear("Battle of Changsha (1941–1942)", 1942)).toBe(1942);
  });
});

describe("버린다 — 이 줄의 사건이 아닌 범위", () => {
  /**
   * 「1956-1967년 계획」이라는 **문서 이름**이다. 사건은 그 문서가 나온 것이고 기간이 없다.
   * status.md가 처음부터 지목하던 경우다.
   */
  it("서명 안의 범위는 문서 이름이다", () => {
    expect(textEndYear("12月，《1956-1967年科学技术发展远景规划纲要》正式出台。", 1956)).toBeNull();
    expect(textEndYear("《1592-1598年戰爭史》가 간행됨", 1592)).toBeNull();
    // 서명이 **닫힌 뒤**의 범위는 그 규칙 밖이다 — 그때는 이름에 붙은 기간으로 본다
    expect(textEndYear("巴金著《家》(1931-1940)를 완성", 1931)).toBe(1940);
  });

  /**
   * 이 줄의 사건은 환남사변인데 범위는 뒤 문장의 태평양 전쟁 것이다.
   * 그대로 두면 환남사변이 1945년까지 이어지는 막대가 된다.
   */
  it("문장이 끝난 뒤의 범위는 다른 절의 것이다", () => {
    expect(textEndYear("1941年：皖南事变。太平洋戰爭（1941-1945）起。12月9日…", 1941)).toBeNull();
    expect(textEndYear("1931年：中国第一辆汽车下线。九一八事变，東三省被日本关东军佔領（1931-1937）。", 1931)).toBeNull();
  });

  /**
   * 라틴 마침표는 종결로 보지 않는다. `Jan.`·`U.S.`·`c.`가 걸려 멀쩡한 기간이 죽는다 —
   * 실측에서 잘못 잡힌 뒷절 셋은 전부 CJK 종결부호였다.
   */
  it("라틴 마침표는 종결이 아니다", () => {
    expect(textEndYear("Jan. 5 — U.S. Civil War (1861–1865) begins", 1861)).toBe(1865);
  });
});

describe("범위 자체가 말이 되어야 한다", () => {
  it("이 줄의 해와 시작이 멀면 버린다 — 왕조 길이가 사건에 붙는 것을 막는다", () => {
    expect(textEndYear("청나라(1636–1912) 시기의 어떤 사건", 1800)).toBeNull();
  });

  it("100년을 넘는 범위는 사건이 아니다", () => {
    expect(textEndYear("Something (1600–1750)", 1600)).toBeNull();
  });

  it("거꾸로거나 같은 해면 기간이 아니다", () => {
    expect(textEndYear("Something (1700–1700)", 1700)).toBeNull();
    expect(textEndYear("Something (1700–1650)", 1700)).toBeNull();
  });

  it("범위가 없으면 null", () => {
    expect(textEndYear("임진왜란이 일어남", 1592)).toBeNull();
    expect(textEndYear("", 1592)).toBeNull();
  });
});
