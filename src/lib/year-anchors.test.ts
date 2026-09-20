import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **연도 페이지가 사건 단위를 가리킬 수 있는가.**
 *
 * 10,104개 연도 페이지에 사건 이름이 이미 다 들어 있었는데 **앵커도 링크도 없었다** —
 * 검색 결과나 공유 링크가 닿을 자리가 없고, 내부 링크가 **연도±1뿐**이라 2,525년짜리
 * 선형 사슬이었다.
 *
 * 줄마다 `id={e.id}`를 주어 `/y/1592#ev_…`가 특정 사건을 가리키고, 이름을 격자 딥링크
 * (`/?y=…&e=ev_…`)로 걸어 그 사슬을 격자와 잇는다.
 *
 * **SEO 효과는 과장하지 않는다** — `/?…` 조합 URL은 noindex라 링크 주스는 흐르지 않는다.
 * 이 변경의 값은 사람이 찾아가는 길이고, 크롤러에게는 앵커가 생기는 것까지다.
 */
const src = readFileSync(path.join(__dirname, "../components/pages/YearArticle.tsx"), "utf8");

describe("연도 페이지의 사건 줄", () => {
  it("줄마다 앵커가 있다", () => {
    // 그 해의 사건 · 앞뒤 문맥 둘 다
    expect(src.match(/<li key=\{e\.id\} id=\{e\.id\}/g)?.length).toBe(2);
  });

  it("이름이 격자 딥링크로 걸린다", () => {
    expect(src.match(/\?y=\$\{e\.y0\}&s=40&e=\$\{e\.id\}/g)?.length).toBe(2);
  });

  it("언어를 잃지 않는다 — 그리드는 ?lang= 으로 언어를 받는다", () => {
    expect(src).toContain('locale === "ko" ? "" : `&lang=${locale}`');
  });

  /**
   * 문맥 연도 줄만 `formatYearL`을 안 쓰고 손으로 "BC"를 찍고 있었다. 같은 페이지의 h1·요약이
   * 「기원전 479년」·「公元前479年」일 때 그 줄만 `BC479`였다(ja·zh·en UI).
   */
  it("연도 표기를 손으로 만들지 않는다", () => {
    expect(src).not.toContain("`BC${1 - e.y0}`");
    expect(src).not.toMatch(/e\.y0 <= 0 \? `BC/);
  });
});
