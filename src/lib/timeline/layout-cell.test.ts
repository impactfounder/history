import { describe, expect, it } from "vitest";

import { CELL_PAD, ITEM_GAP, ITEM_H, MORE_BADGE_BAND, MORE_LANE_W } from "@/lib/design/metrics";
import { layoutCell } from "./layout-cell";

/**
 * 셀 안 배치. 두 단계(높이 예산 → 시점 위치)는 기존 규칙 그대로이고,
 * 1b에서 높이가 등급에서 나오는 것과 배지 레인이 더해졌다.
 */

type Ev = { id: string; y0: number; m?: number; title: string; lang: string; names: Record<string, never>; title_ko?: string };

/** lang="ko" → itemKind가 lead. 표제어 없이 등급을 정하는 가장 짧은 길이다. */
const lead = (id: string, y0: number, m?: number): Ev => ({ id, y0, ...(m ? { m } : {}), title: `사건 ${id}`, lang: "ko", names: {} });
/** lang="en" + ko 로케일 → plain. */
const plain = (id: string, y0: number, m?: number): Ev => ({ id, y0, ...(m ? { m } : {}), title: `Event ${id}`, lang: "en", names: {} });

const run = (evs: Ev[], h: number, b = 1900, unit = 10) => layoutCell(evs, h, b, unit, "ko");

describe("높이 예산 — 개수가 아니라 높이로 자른다", () => {
  it("십년 행 80px에 lead 2건이 들어가고 3번째는 넘친다", () => {
    const { placed, hidden } = run([lead("a", 1900), lead("b", 1903), lead("c", 1906)], 80);
    expect(placed).toHaveLength(2);
    expect(hidden).toBe(1);
  });

  it("같은 80px에 plain은 2건 — 28×2 + 간격 2 = 58 ≤ 76", () => {
    const { placed } = run([plain("a", 1900), plain("b", 1903), plain("c", 1906)], 80);
    expect(placed).toHaveLength(2);
  });

  it("행이 높아지면 더 들어간다 — 세기 행 200px", () => {
    const evs = Array.from({ length: 10 }, (_, i) => lead(String(i), 1900 + i * 10));
    const { placed } = run(evs, 200, 1900, 100);
    expect(placed.length).toBeGreaterThan(2);
    expect(placed.length).toBeLessThanOrEqual(10);
  });

  it("등급이 섞이면 높이 합으로 판정한다", () => {
    // lead 34 + plain 28 + 간격 2 = 64 ≤ 76, 여기에 lead 하나 더는 안 된다
    const { placed, hidden } = run([lead("a", 1900), plain("b", 1902), lead("c", 1904)], 80);
    expect(placed.map((p) => p.kind)).toEqual(["lead", "plain"]);
    expect(hidden).toBe(1);
  });

  it("행이 항목 하나도 못 담으면 전부 숨는다", () => {
    const { placed, hidden } = run([lead("a", 1900)], ITEM_H.lead);
    expect(placed).toHaveLength(0);
    expect(hidden).toBe(1);
  });

  it("빈 셀은 빈 채로 — 채우기 위한 장식을 넣지 않는다", () => {
    const { placed, hidden } = run([], 80);
    expect(placed).toHaveLength(0);
    expect(hidden).toBe(0);
  });
});

describe("등급이 높이를 정한다", () => {
  it("lead는 ITEM_H.lead, plain은 ITEM_H.plain", () => {
    const { placed } = run([lead("a", 1900), plain("b", 1905)], 200);
    expect(placed.find((p) => p.ev.id === "a")!.h).toBe(ITEM_H.lead);
    expect(placed.find((p) => p.ev.id === "b")!.h).toBe(ITEM_H.plain);
  });

  it("title_ko가 붙으면 plain이 lead가 되고 높이도 따라 커진다", () => {
    const e = plain("a", 1900);
    expect(run([e], 200).placed[0]!.h).toBe(ITEM_H.plain);
    expect(run([{ ...e, title_ko: "번역된 제목" }], 200).placed[0]!.h).toBe(ITEM_H.lead);
  });
});

describe("시점 위치 — 행 안에서 실제 연도 자리에 놓는다", () => {
  it("행이 높으면 시간을 따라 퍼진다", () => {
    // 200px 세기 행, 1900·1950 → 위쪽과 한가운데
    const { placed } = run([lead("a", 1900), lead("b", 1950)], 200, 1900, 100);
    const a = placed.find((p) => p.ev.id === "a")!;
    const b = placed.find((p) => p.ev.id === "b")!;
    expect(a.top).toBe(CELL_PAD);
    expect(b.top).toBeGreaterThan(80);
  });

  it("월 표기가 있으면 그만큼 아래로 — 연 오프셋 (m−1)/12", () => {
    const jan = run([lead("a", 1900, 1)], 200, 1900, 100).placed[0]!;
    const dec = run([lead("a", 1900, 12)], 200, 1900, 100).placed[0]!;
    expect(dec.top).toBeGreaterThan(jan.top);
  });

  it("시간 순으로 정렬된다 — 청크는 중요도 순이지만 배치는 연도 순", () => {
    const { placed } = run([lead("late", 1980), lead("early", 1902)], 200, 1900, 100);
    expect(placed.map((p) => p.ev.id)).toEqual(["early", "late"]);
  });

  it("바닥을 넘기지 않는다", () => {
    const { placed } = run([lead("a", 1999)], 200, 1900, 100);
    expect(placed[0]!.top + placed[0]!.h).toBeLessThanOrEqual(200 - CELL_PAD);
  });
});

describe("겹침 밀기 — 앞 항목과 겹치면 아래로", () => {
  it("같은 해 두 건이 겹치지 않는다", () => {
    const { placed } = run([lead("a", 1900), lead("b", 1900)], 200, 1900, 100);
    expect(placed).toHaveLength(2);
    const [first, second] = placed;
    expect(second!.top).toBeGreaterThanOrEqual(first!.top + first!.h);
  });

  it("밀린 간격이 ITEM_GAP 이상이다", () => {
    const { placed } = run([lead("a", 1900), lead("b", 1900)], 200, 1900, 100);
    expect(placed[1]!.top - (placed[0]!.top + placed[0]!.h)).toBeGreaterThanOrEqual(ITEM_GAP);
  });

  it("밀다가 바닥을 넘으면 거기서 멈추고 나머지는 숨는다", () => {
    const evs = Array.from({ length: 6 }, (_, i) => lead(String(i), 1998));
    const { placed, hidden } = run(evs, 200, 1900, 100);
    expect(placed.length).toBeLessThan(6);
    expect(hidden).toBe(6 - placed.length);
    for (const p of placed) expect(p.top + p.h).toBeLessThanOrEqual(200 - CELL_PAD);
  });
});

describe("배지 레인 — 「N건 더」가 글줄 위에 겹쳐 찍히지 않게", () => {
  it("숨은 것이 없으면 레인을 비우지 않는다", () => {
    const { placed, hidden } = run([lead("a", 1900)], 200, 1900, 100);
    expect(hidden).toBe(0);
    expect(placed.every((p) => p.laneEnd === 0)).toBe(true);
  });

  it("숨은 것이 있으면 아래쪽 띠와 겹치는 항목만 레인을 받는다", () => {
    // 200px 행에 1900·1990 두 건 + 숨은 것 하나 → 아래쪽 것만 배지 띠와 겹친다
    const evs = [lead("top", 1900), lead("bottom", 1990), ...Array.from({ length: 8 }, (_, i) => lead("x" + i, 1950))];
    const { placed, hidden } = run(evs, 200, 1900, 100);
    expect(hidden).toBeGreaterThan(0);
    const avail = 200 - CELL_PAD * 2;
    for (const p of placed) {
      const overlaps = p.top + p.h > avail - MORE_BADGE_BAND;
      expect(p.laneEnd).toBe(overlaps ? MORE_LANE_W : 0);
    }
  });

  it("띠와 겹치는 항목이 실제로 존재하는 배치에서 레인이 켜진다", () => {
    const evs = [lead("a", 1900), lead("b", 1903), lead("c", 1906)];
    const { placed, hidden } = run(evs, 80);
    expect(hidden).toBe(1);
    // 80px 행의 가용 76px, 배지 띠는 아래 20px — 두 번째 항목이 걸린다
    expect(placed.some((p) => p.laneEnd === MORE_LANE_W)).toBe(true);
  });
});

describe("순수 함수", () => {
  it("같은 입력에 같은 출력", () => {
    const evs = [lead("a", 1900), plain("b", 1905), lead("c", 1908)];
    expect(run(evs, 120)).toEqual(run(evs, 120));
  });

  it("입력 배열을 건드리지 않는다", () => {
    const evs = [lead("a", 1980), lead("b", 1902)];
    const before = evs.map((e) => e.id);
    run(evs, 200, 1900, 100);
    expect(evs.map((e) => e.id)).toEqual(before);
  });
});
