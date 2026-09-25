import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { decodeYears } from "@/lib/timeline/gap";

/**
 * **세기 칸은 비지 않는다**(2026-09-26, tools/publish.mjs CENTURY_FILL).
 *
 * 세기 청크가 중요도 5만 싣던 때, 중요도 5가 없는 세기는 사건이 수십 건 있어도 「N건 더」조차 없는
 * 빈 칸이었다 — 가장 줄인 화면에서 한국 200년대가 비어 있었다(대표 지적). 발행물 기준으로 지킨다:
 * 연도 색인(years.json)에 사건이 있는 세기는 세기 청크에도 한 건 이상 있어야 한다.
 */
const V1 = path.join(process.cwd(), "public/data/v1");
const published = existsSync(path.join(V1, "years.json"));
const century = (y: number) => Math.floor(y / 100) * 100;

describe.skipIf(!published)("세기 청크 — 사건이 있는 세기 칸은 비지 않는다", () => {
  const years: Record<string, number[]> = JSON.parse(readFileSync(path.join(V1, "years.json"), "utf8")).years;

  for (const region of Object.keys(years)) {
    it(region, () => {
      const file = path.join(V1, "events", region, "century", "all.json");
      const inChunk = new Set<number>(
        existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")).events as { y0: number }[]).map((e) => century(e.y0)) : [],
      );
      const withEvents = new Set(decodeYears(years[region]!).map(century));
      const missing = [...withEvents].filter((c) => !inChunk.has(c)).sort((a, b) => a - b);
      expect(missing).toEqual([]);
    });
  }
});
