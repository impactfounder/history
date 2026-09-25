import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { CELL_PAD, ITEM_GAP, ITEM_H_COMPACT } from "@/lib/design/metrics";
import { layoutCell } from "@/lib/timeline/layout-cell";
import type { LabelSource } from "@/lib/i18n";

/**
 * **십년 청크의 앞부분 · 뒷부분**(2026-09-25, 진단 보고서 개선 8).
 *
 * 첫 화면(1980 · s=8 · 5열)이 gzip 230KB를 받았고 그중 219KB가 십년 청크였다. s=8의 십년 칸에는
 * 칩이 3개만 서는데 청크는 이 레벨의 최대 확대(칸당 19개)를 대비해 전부를 싣고 있었다. 그래서
 * tools/publish.mjs가 행마다 앞의 `head`건을 앞부분에, 나머지를 `.more.json`에 같은 순서로 둔다.
 *
 * 여기서 지키는 것은 넷이다 — 나눠도 **잃는 것이 없다**, 행별 총수가 맞다, 필요 없는 뒷부분은
 * 없다, 그리고 **첫 화면은 앞부분만으로 충분하다**(그래야 나눈 뜻이 있다).
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const published = existsSync(path.join(DATA, "regions.json"));

type Ev = { id: string; y0: number };
type Head = { count: number; head: number; counts: Record<string, number>; events: Ev[] };
const REGIONS = ["ai", "kr", "cn", "jp", "us"];
const row = (y: number) => Math.floor(y / 10) * 10;

describe.skipIf(!published)("십년 청크 나누기", () => {
  const files: { region: string; key: string; head: Head; more: Ev[] | null }[] = [];
  for (const r of REGIONS) {
    const dir = path.join(DATA, "events", r, "decade");
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".more.json")) continue;
      const key = f.replace(/\.json$/, "");
      const morePath = path.join(dir, `${key}.more.json`);
      files.push({
        region: r,
        key,
        head: JSON.parse(readFileSync(path.join(dir, f), "utf8")),
        more: existsSync(morePath) ? JSON.parse(readFileSync(morePath, "utf8")).events : null,
      });
    }
  }

  it("앞부분 파일이 자기 크기와 행별 총수를 싣는다", () => {
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      expect(f.head.head, `${f.region}/${f.key}`).toBeGreaterThan(0);
      expect(f.head.counts, `${f.region}/${f.key}`).toBeDefined();
    }
  });

  it("앞 + 뒤 = 전체 — 잃는 사건도 겹치는 사건도 없다", () => {
    for (const f of files) {
      const all = [...f.head.events, ...(f.more ?? [])];
      expect(all.length, `${f.region}/${f.key}`).toBe(f.head.count);
      expect(new Set(all.map((e) => e.id)).size, `${f.region}/${f.key} 중복`).toBe(all.length);
      const sum = Object.values(f.head.counts).reduce((a, b) => a + b, 0);
      expect(sum, `${f.region}/${f.key} counts 합`).toBe(f.head.count);
    }
  });

  it("앞부분은 행마다 head건을 넘지 않고, 뒷부분이 있는 행은 앞부분이 꽉 차 있다", () => {
    for (const f of files) {
      const inHead = new Map<number, number>();
      for (const e of f.head.events) inHead.set(row(e.y0), (inHead.get(row(e.y0)) ?? 0) + 1);
      for (const [b, n] of inHead) expect(n, `${f.region}/${f.key} ${b}`).toBeLessThanOrEqual(f.head.head);
      for (const e of f.more ?? []) expect(inHead.get(row(e.y0)), `${f.region}/${f.key} ${row(e.y0)}`).toBe(f.head.head);
    }
  });

  it("뒷부분이 필요 없는 청크에는 뒷부분 파일이 없다 — 격자가 헛걸음하지 않는다", () => {
    for (const f of files) {
      const needs = Object.values(f.head.counts).some((n) => n > f.head.head);
      expect(f.more !== null, `${f.region}/${f.key}`).toBe(needs);
    }
  });

  /**
   * **첫 화면은 앞부분만으로 충분하다.** s=8(TimelineGrid LANDING_S)의 십년 칸 높이 80px에 가장 낮은
   * 칩(20px)으로 세도 앞부분 크기를 넘지 않아야 한다 — 넘으면 첫 화면이 뒷부분까지 받아 나눈 뜻이 없다.
   */
  it("첫 화면(s=8) 칸에 서는 최대 개수가 앞부분 크기 안이다", () => {
    const LANDING_S = 8;
    const cap = Math.floor((10 * LANDING_S - CELL_PAD * 2 + ITEM_GAP) / (ITEM_H_COMPACT.plain + ITEM_GAP));
    for (const f of files) expect(cap, `${f.region}/${f.key}`).toBeLessThanOrEqual(f.head.head);
  });

  it("첫 화면 십년 청크(1900 · 2000 × 5열)가 gzip 100KB 안이다 — 나누기 전 219KB", () => {
    let gz = 0;
    for (const f of files) if (f.key === "1900" || f.key === "2000") gz += gzipSync(JSON.stringify(f.head)).length;
    expect(gz / 1024).toBeLessThan(100);
  });
});

describe("배지 수는 칸의 총수를 따른다", () => {
  const ev = (i: number) => ({ id: `e${i}`, y0: 1980 + (i % 10), title: `사건 ${i}`, name_ko: `사건 ${i}`, lang: "ko", names: {} }) as unknown as LabelSource & { y0: number; id: string };

  it("받은 것이 다 서도 뒤에 더 있으면 「N건 더」가 남는다", () => {
    const evs = [ev(0), ev(1)];
    const { placed, hidden } = layoutCell(evs, 400, 1980, 10, "ko", undefined, undefined, 0, 9);
    expect(placed.length).toBe(2);
    expect(hidden).toBe(7);
  });

  it("그때도 배지 자리가 비워진다 — 아래쪽 칩이 배지 레인을 비운다", () => {
    const evs = Array.from({ length: 3 }, (_, i) => ev(i + 7)); // 1987~1989 — 칸 아래쪽
    const { placed } = layoutCell(evs, 80, 1980, 10, "ko", undefined, undefined, 0, 12);
    expect(placed.some((p) => p.laneEnd > 0)).toBe(true);
  });

  it("총수를 안 주면 예전과 같다", () => {
    const evs = [ev(0), ev(1)];
    expect(layoutCell(evs, 400, 1980, 10, "ko").hidden).toBe(0);
  });
});
