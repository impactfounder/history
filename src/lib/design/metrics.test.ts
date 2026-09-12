import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AXIS_LABEL_W,
  AXIS_LABEL_W_COMPACT,
  AXIS_W,
  AXIS_W_COMPACT,
  CARD_GAP,
  CELL_PAD,
  COLUMN_HEADER_H,
  ERA_TICK_W,
  HIT_COMFORT,
  HIT_MIN,
  ITEM_GAP,
  ITEM_H,
  ITEM_INSET_END,
  ITEM_H_COMPACT,
  ITEM_INSET_START,
  itemHeights,
  LUG_W,
  MINIMAP_W,
  MINIMAP_W_COMPACT,
  MORE_BADGE_BAND,
  MORE_LANE_W,
  MORE_LANE_W_COMPACT,
  TOPBAR_H,
  ZOOM_FLOAT_H,
  ZOOM_FLOAT_INSET,
} from "./metrics";

/**
 * 치수 계약. metrics.ts가 원본이고 globals.css가 사본이므로, 한쪽만 고치면 여기서 깨진다.
 * 이 레포에는 eslint가 없고(next lint는 Next 16에서 제거됐다) 게이트가 vitest·tsc뿐이라
 * 규칙은 테스트로 만들어야 실제로 돈다.
 */
const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
/** 규칙 검사는 실제 선언만 본다 — 주석에는 그 규칙을 설명하는 문구가 그대로 들어 있다. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** @theme 안의 `--size-<name>: <n>px;`을 읽는다. */
function sizeToken(name: string): number | null {
  const m = css.match(new RegExp(`--size-${name}:\\s*(-?[\\d.]+)px\\s*;`));
  return m ? Number(m[1]) : null;
}

describe("치수 토큰 — metrics.ts(원본) ↔ globals.css(사본)", () => {
  const pairs: [string, number][] = [
    ["item-lead", ITEM_H.lead],
    ["item-plain", ITEM_H.plain],
    ["item-lead-compact", ITEM_H_COMPACT.lead],
    ["item-plain-compact", ITEM_H_COMPACT.plain],
    ["item-gap", ITEM_GAP],
    ["cell-pad", CELL_PAD],
    ["item-inset-start", ITEM_INSET_START],
    ["item-inset-end", ITEM_INSET_END],
    ["more-badge-band", MORE_BADGE_BAND],
    ["more-lane", MORE_LANE_W],
    ["more-lane-compact", MORE_LANE_W_COMPACT],
    ["col-header", COLUMN_HEADER_H],
    ["card-gap", CARD_GAP],
    ["lug", LUG_W],
    ["era-tick", ERA_TICK_W],
    ["axis", AXIS_W],
    ["minimap", MINIMAP_W],
    ["axis-label", AXIS_LABEL_W],
    ["axis-compact", AXIS_W_COMPACT],
    ["minimap-compact", MINIMAP_W_COMPACT],
    ["axis-label-compact", AXIS_LABEL_W_COMPACT],
    ["hit-min", HIT_MIN],
    ["hit-comfort", HIT_COMFORT],
    ["topbar", TOPBAR_H],
    ["zoom-float", ZOOM_FLOAT_H],
    ["zoom-float-inset", ZOOM_FLOAT_INSET],
  ];

  for (const [token, value] of pairs) {
    it(`--size-${token} = ${value}px`, () => {
      expect(sizeToken(token)).toBe(value);
    });
  }

  it("globals.css의 --size-* 가 metrics.ts보다 많거나 적지 않다", () => {
    const inCss = new Set([...css.matchAll(/--size-([a-z-]+):/g)].map((m) => m[1]!));
    expect([...inCss].sort()).toEqual(pairs.map(([t]) => t).sort());
  });
});

describe("항목 높이의 성질", () => {
  it("lead가 plain보다 높다 — 두 줄(제목 + 메타) 대 한 줄", () => {
    expect(ITEM_H.lead).toBeGreaterThan(ITEM_H.plain);
  });

  it("십년 행(80px)에 lead 2건이 들어가고 3건은 넘친다", () => {
    const avail = 80 - CELL_PAD * 2;
    expect(ITEM_H.lead * 2 + ITEM_GAP).toBeLessThanOrEqual(avail);
    expect(ITEM_H.lead * 3 + ITEM_GAP * 2).toBeGreaterThan(avail);
  });

  it("축은 미니맵 + 라벨로 정확히 쪼개진다 — 넓은 화면·좁은 화면 둘 다", () => {
    expect(MINIMAP_W + AXIS_LABEL_W).toBe(AXIS_W);
    expect(MINIMAP_W_COMPACT + AXIS_LABEL_W_COMPACT).toBe(AXIS_W_COMPACT);
  });

  it("굵은 포인터에서는 항목 높이가 AA 하한(24px) 아래로 내려가지 않는다", () => {
    for (const narrow of [false, true]) {
      const h = itemHeights(narrow, true);
      expect(h.lead).toBeGreaterThanOrEqual(HIT_MIN);
      expect(h.plain).toBeGreaterThanOrEqual(HIT_MIN);
    }
  });

  it("항목이 세로로 쌓이므로 높이가 곧 간격이다 — 굵은 포인터에서 중심 간격도 24px 이상", () => {
    // SC 2.5.8의 "간격" 예외는 중심이 24px 떨어져야 성립한다. 같은 칸에 쌓인 항목의
    // 중심 간격은 높이 + ITEM_GAP이므로, 높이가 24면 간격은 자동으로 넘긴다.
    for (const narrow of [false, true]) {
      const h = itemHeights(narrow, true);
      expect(h.plain + ITEM_GAP).toBeGreaterThanOrEqual(HIT_MIN);
    }
  });

  it("가는 포인터는 밀도를 잃지 않는다 — 좁은 화면 값이 그대로다", () => {
    expect(itemHeights(true, false)).toEqual(ITEM_H_COMPACT);
    expect(itemHeights(false, false)).toEqual(ITEM_H);
  });

  it("십년 칸(80px)은 24px로 올려도 plain 3건이 그대로 들어간다 — 대가가 없다", () => {
    // 20 → 24로 올렸을 때 가장 자주 보는 칸에서 건수가 줄지 않는다는 것이
    // 이 변경을 값싸게 만든다. 76 = 80 − 여백 4, 24×3 + 2×2 = 76으로 딱 맞는다.
    const avail = 80 - CELL_PAD * 2;
    const fits = (h: number) => Math.floor((avail + ITEM_GAP) / (h + ITEM_GAP));
    expect(fits(ITEM_H_COMPACT.plain)).toBe(3);
    expect(fits(itemHeights(true, true).plain)).toBe(3);
  });

  it("대가는 더 높은 행에서 나온다 — 100px 칸은 4건에서 3건으로", () => {
    // 연도 레벨처럼 행이 높아지면 24px의 대가가 실제로 보인다. 숨기지 않고 적어 둔다.
    const avail = 100 - CELL_PAD * 2;
    const fits = (h: number) => Math.floor((avail + ITEM_GAP) / (h + ITEM_GAP));
    expect(fits(ITEM_H_COMPACT.plain)).toBe(4);
    expect(fits(itemHeights(true, true).plain)).toBe(3);
  });

  it("좁은 화면 항목이 더 낮다 — 메타 줄을 접기 때문", () => {
    expect(ITEM_H_COMPACT.lead).toBeLessThan(ITEM_H.lead);
    expect(ITEM_H_COMPACT.plain).toBeLessThan(ITEM_H.plain);
    expect(ITEM_H_COMPACT.lead).toBeGreaterThan(ITEM_H_COMPACT.plain);
  });

  it("390px 폰 십년 행(80px)에 좁은 항목 3건이 들어간다", () => {
    const avail = 80 - CELL_PAD * 2;
    expect(ITEM_H_COMPACT.lead * 3 + ITEM_GAP * 2).toBeLessThanOrEqual(avail);
  });

  it("배지 레인이 항목 오른쪽 여백보다 넓다 — 그래야 글줄을 실제로 비운다", () => {
    expect(MORE_LANE_W).toBeGreaterThan(ITEM_INSET_END);
  });
});

describe("토큰 층 구조", () => {
  it("원시에는 --color- 접두가 없다(유틸리티로 새어나가지 않게)", () => {
    expect(css).toMatch(/--ink-500:/);
    expect(css).not.toMatch(/--color-ink-/);
  });

  it("dark: 유틸리티를 쓰지 않는다 — 다크는 토큰 재대입으로만", () => {
    expect(code).not.toMatch(/\bdark:/);
  });

  it("@theme inline을 쓰지 않는다(다크 덮어쓰기를 무력화한다)", () => {
    expect(code).not.toMatch(/@theme\s+inline/);
  });

  it("지역 4색이 전부 원시로 정의돼 있다", () => {
    for (const r of ["kr", "cn", "jp", "us"]) expect(css).toMatch(new RegExp(`--region-${r}:`));
  });

  it("정치체 밴드 토큰은 전부 사라졌다 — 1b는 열 배경을 칠하지 않는다", () => {
    expect(code).not.toMatch(/--color-region-\w+-band-/);
    expect(code).not.toMatch(/--color-region-\w+-label-edge/);
  });

  it("러그 두 톤·시대 틱·기간 프레임이 무채색 토큰으로 있다", () => {
    for (const t of ["--color-lug-a", "--color-lug-b", "--color-era-tick", "--color-span-frame"]) {
      expect(code).toMatch(new RegExp(t + ":"));
    }
  });

  it("인라인 var()로만 쓰는 토큰은 @theme 밖에 있다 — 트리셰이킹으로 지워진다", () => {
    // 컴포넌트가 template literal로 var(--color-region-${id})를 만들면 리터럴 이름이 소스에
    // 없어 Tailwind가 "미사용"으로 지운다. 2026-09-09에 실제로 지워져 나라 색이 통째로 죽었다.
    const theme = code.slice(code.indexOf("@theme"), code.indexOf("}", code.indexOf("--radius-item")));
    for (const r of ["kr", "cn", "jp", "us"]) {
      expect(theme).not.toMatch(new RegExp(`--color-region-${r}:`));
      expect(code).toMatch(new RegExp(`--color-region-${r}: var\\(--region-${r}\\)`));
    }
  });

  it("명조체 토큰이 있고 next/font 변수를 먼저 본다", () => {
    expect(code).toMatch(/--font-serif:\s*var\(--font-noto-serif-kr\)/);
  });

  it("그림자는 @theme 밖에 있다 — Tailwind가 값을 유틸리티에 인라인하면 재대입이 안 통한다", () => {
    const theme = code.slice(code.indexOf("@theme"), code.indexOf("}", code.indexOf("--radius-item")));
    expect(theme).not.toMatch(/--shadow-/);
    expect(code).toMatch(/--shadow-float:/);
    expect(code).toMatch(/--shadow-sheet:/);
  });
});
