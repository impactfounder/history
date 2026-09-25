import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { uncoveredFraction } from "./uncovered";

describe("행 하나 중 수록 전인 비율", () => {
  it("수록 시작보다 앞선 행은 전부 빗금이다", () => {
    expect(uncoveredFraction(1500, 100, 1607)).toBe(1);
    expect(uncoveredFraction(-499, 1, 1607)).toBe(1);
  });

  it("경계가 걸친 행은 걸친 만큼만 — 1600년대 세기 행의 위 7%", () => {
    expect(uncoveredFraction(1600, 100, 1607)).toBeCloseTo(0.07);
    expect(uncoveredFraction(1600, 10, 1607)).toBeCloseTo(0.7);
  });

  it("수록 시작 해부터는 빗금이 없다 — 1607년 행은 수록 구간이다", () => {
    expect(uncoveredFraction(1607, 1, 1607)).toBe(0);
    expect(uncoveredFraction(1700, 100, 1607)).toBe(0);
  });

  it("수록 시작이 없는 열은 축 전체를 수록한다", () => {
    expect(uncoveredFraction(-499, 100, undefined)).toBe(0);
  });
});

/**
 * **빗금 아래에는 사건이 없어야 한다.** 빗금은 「아직 수록하지 않았다」는 주장이다 — 그 아래에 칩이
 * 하나라도 서면 화면이 스스로를 부정한다. derive.mjs가 `COVERAGE_FROM` 이전 행을 걸러 내므로 지금은
 * 참이지만, 원천을 더하거나 필터를 고치는 날 조용히 깨질 수 있다.
 */
const DATA = path.join(__dirname, "../../../public/data/v1");
const published = existsSync(path.join(DATA, "regions.json"));

describe.skipIf(!published)("빗금과 발행 데이터", () => {
  const regions = JSON.parse(readFileSync(path.join(DATA, "regions.json"), "utf8")).regions as { id: string; coverage_from?: number }[];
  const withCoverage = regions.filter((r) => r.coverage_from != null);

  it("수록 시작을 가진 열이 있다 — 0이면 아래 검사가 무의미하다", () => {
    expect(withCoverage.length).toBeGreaterThan(0);
  });

  it("어느 열도 수록 시작 전의 사건을 싣지 않는다", () => {
    for (const r of withCoverage) {
      const dir = path.join(DATA, "events", r.id, "year");
      const early: string[] = [];
      for (const f of readdirSync(dir)) {
        for (const e of JSON.parse(readFileSync(path.join(dir, f), "utf8")).events ?? []) {
          if (e.y0 < r.coverage_from!) early.push(`${e.y0} ${e.id}`);
        }
      }
      expect(early.slice(0, 5), `${r.id}: ${r.coverage_from} 이전`).toEqual([]);
    }
  });
});
