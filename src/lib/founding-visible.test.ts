import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **나라의 시작이 첫 화면에 있는가.** 규칙이 아니라 **결과**를 본다 —
 * `tools/founding.test.ts`가 "이 문장이 건국인가"를 보고, 여기서는 "그래서 화면에 떴는가"를 본다.
 *
 * 증상이 이랬다(대표 지적 2026-09-20): 세기 레벨 한국 열 1900년대에 「삼성 설립」·「남극 첫 탐험」·
 * 「엠폭스 유행」은 있는데 **「대한민국 정부 수립」이 없었다.** 원인은 둘이었다.
 *
 *   1) **병합이 중요도를 버렸다.** `dedupe.mjs`가 국편 줄과 위키 줄을 같은 사건으로 묶고 국편 줄을
 *      대표로 골랐는데(이름이 더 낫다), 위키 줄의 중요도 5를 물려받지 않았다. 301묶음 중 104개가
 *      그랬다.
 *   2) **순서가 언어판 수였다.** 중요도가 같으면 sl로 줄을 세우므로 「제주 4·3 사건」(23)이
 *      「대한민국 정부 수립」(12) 앞에 섰다.
 *
 * 세기 레벨은 `imp>=5`, 십년은 `imp>=4`만 싣는다. 그래서 1)이 풀리기 전까지 이 사건들은
 * **연도 레벨까지 확대해야만** 보였다.
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const published = existsSync(path.join(DATA, "polities.json"));

/** 발행 산출물은 git에 없다(prebuild가 만든다). 없으면 이 테스트는 할 말이 없다. */
describe.skipIf(!published)("나라의 시작은 그 해의 맨 앞에 선다", () => {
  const load = (region: string) => {
    const seen = new Map<string, Record<string, unknown>>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".json")) {
          for (const ev of JSON.parse(readFileSync(p, "utf8")).events ?? []) seen.set(ev.id, ev);
        }
      }
    };
    walk(path.join(DATA, "events", region));
    return [...seen.values()];
  };

  const century = (region: string) =>
    JSON.parse(readFileSync(path.join(DATA, "events", region, "century/all.json"), "utf8")).events as Record<string, unknown>[];

  const labelOf = (e: Record<string, unknown>) => String(e.name_ko ?? e.title_ko ?? e.title ?? "");

  it("표시된 사건이 있다 — 0이면 아래 검사가 전부 무의미하다", () => {
    const n = ["kr", "cn", "jp", "us", "ai"].reduce((a, r) => a + load(r).filter((e) => e.f).length, 0);
    expect(n).toBeGreaterThan(10);
  });

  /** 대표가 직접 짚은 사건들. 하나라도 빠지면 같은 지적이 다시 나온다. */
  it.each([
    ["kr", 1948, "대한민국 정부 수립"],
    ["kr", 1392, "조선 건국"],
    ["kr", 918, "고려 건국"],
    ["cn", 1949, "중화인민공화국"],
    ["cn", 1368, "명나라 건국"],
  ])("%s %i — %s 가 세기 레벨에 있다", (region, year, needle) => {
    const hit = century(region).filter((e) => e.y0 === year && labelOf(e).includes(needle));
    expect(hit.length, `${region} ${year}년 세기 레벨에 「${needle}」이 없다`).toBeGreaterThan(0);
  });

  it("1948년 한국 열에서 「대한민국 정부 수립」이 맨 앞이다", () => {
    const cell = century("kr").filter((e) => e.y0 === 1948);
    expect(cell.length).toBeGreaterThan(1); // 경쟁자가 있어야 순서 검사가 뜻을 가진다
    expect(labelOf(cell[0]!)).toContain("대한민국 정부 수립");
  });

  /**
   * 표시된 것은 전부 중요도 5여야 한다 — 그러지 않으면 세기 청크(`imp>=5`)에 실리지 않아
   * 표시 자체가 무의미해진다.
   */
  it("표시된 사건은 모두 중요도 5다", () => {
    for (const r of ["kr", "cn", "jp", "us", "ai"]) {
      for (const e of load(r).filter((x) => x.f)) {
        const imp = (e.regions as { imp: number }[])[0]?.imp;
        expect(imp, `${r} ${e.y0} ${labelOf(e)}`).toBe(5);
      }
    }
  });

  /**
   * **정치체마다 한 줄.** 두 줄이 표시되면 같은 셀에 나라 시작이 두 번 서고, 그중 하나는
   * 오탐일 가능성이 높다.
   */
  it("한 정치체에 표시는 하나뿐이다", () => {
    const pol = JSON.parse(readFileSync(path.join(DATA, "polities.json"), "utf8")).regions as Record<string, { y0: number }[]>;
    for (const [region, list] of Object.entries(pol)) {
      const flagged = load(region).filter((e) => e.f);
      for (const p of list) {
        const near = flagged.filter((e) => Math.abs(Number(e.y0) - p.y0) <= 1);
        expect(near.length, `${region} ${p.y0}년 부근에 표시가 ${near.length}개다`).toBeLessThanOrEqual(1);
      }
    }
  });
});
