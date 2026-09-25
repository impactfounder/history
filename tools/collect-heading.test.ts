import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **연도가 절 제목에 있는 문서.** 미국 열이 이 모양 때문에 비어 있었다.
 *
 * 원천이 「pre–United States history」 다음 바로 「1790–1819」로 건너뛰어 **1760~1789가 통째로
 * 없었고**, 그래서 1776년 독립선언도 1787년 헌법도 **행 자체가 없었다**(2026-09-21 실측 — 그
 * 구간은 전부 전투였고, 전투는 위키데이터에서 온 것이었다). 대표가 "국가 설립이 왜 안 나오냐"고
 * 물었을 때 한국·중국은 순위 문제였지만 **미국은 데이터가 없는 문제**였다.
 *
 * 빠진 구간을 덮는 문서(「Timeline of the American Revolution」)는 연도가 **절 제목**에 있고
 * 줄에는 `(July 4)`처럼 날짜만 끝에 붙는다. 기존 수집기는 줄 안에서 연도를 찾으므로
 * **한 줄도 못 건진다.**
 *
 * `collect.mjs`는 import하면 CLI 본문이 돈다. 그래서 여기서는 **소스를 글자로 읽어** 계약을
 * 지킨다 — 다른 도구 테스트(`coverage.test.ts`)가 쓰는 방식과 같다.
 */
const src = readFileSync(path.join(__dirname, "collect.mjs"), "utf8");

describe("절 제목 모드", () => {
  it("모드가 있다", () => {
    expect(src).toContain("function extractHeadingList(html)");
    expect(src).toContain('if (mode === "headingList") return extractHeadingList(html)');
  });

  /**
   * **원천마다 켠다.** 모든 문서에 적용하면 연도 없는 줄이 앞 절의 해로 쏟아져 들어와
   * 기존 다섯 열의 수집 결과가 통째로 달라진다.
   */
  it("옵트인이다 — 진입점이 src.mode를 받는다", () => {
    expect(src).toContain("extract(html, src.mode, src)");
  });

  it("h2·h3만 본다 — 문서 제목(h1)은 절이 아니다", () => {
    expect(src).toMatch(/HEADING_RE = \/<h\[23\]/);
  });

  /** 「Aftermath」·「See also」 같은 절이 앞 절의 해를 물려받으면 안 된다. */
  it("제목이 연도로 시작할 때만 절로 센다", () => {
    expect(src).toContain('/^-?\\d{3,4}\\b/.test(h.text)');
  });

  it("줄이 자기 연도를 말하면 그것을 믿는다", () => {
    expect(src).toContain("date: own ?? year");
  });
});

describe("미국 원천에 빠진 구간이 들어와 있다", () => {
  it("American Revolution 문서를 headingList로 읽는다", () => {
    expect(src).toContain('title: "Timeline of the American Revolution"');
    expect(src).toMatch(/slug: "en-us-revolution", mode: "headingList"/);
  });

  /**
   * 나머지 미국 원천은 1790년부터다. 이 줄이 사라지면 1760~1789가 다시 빈다 —
   * 그때는 아무것도 깨지지 않고 **독립선언만 조용히 없어진다.**
   */
  it("연대별 문서는 여전히 1790부터다 — 이 원천이 그 앞을 덮는다", () => {
    expect(src).toContain('"1790–1819"');
  });
});
