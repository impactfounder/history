import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AXIS_LABEL_W,
  AXIS_W,
  CARD_GAP,
  CELL_PAD,
  COLUMN_HEADER_H,
  ERA_TICK_W,
  HIT_COMFORT,
  HIT_MIN,
  ITEM_GAP,
  ITEM_H,
  ITEM_INSET_END,
  ITEM_INSET_START,
  LUG_W,
  MINIMAP_W,
  MORE_BADGE_BAND,
  MORE_LANE_W,
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
    ["item-gap", ITEM_GAP],
    ["cell-pad", CELL_PAD],
    ["item-inset-start", ITEM_INSET_START],
    ["item-inset-end", ITEM_INSET_END],
    ["more-badge-band", MORE_BADGE_BAND],
    ["more-lane", MORE_LANE_W],
    ["col-header", COLUMN_HEADER_H],
    ["card-gap", CARD_GAP],
    ["lug", LUG_W],
    ["era-tick", ERA_TICK_W],
    ["axis", AXIS_W],
    ["minimap", MINIMAP_W],
    ["axis-label", AXIS_LABEL_W],
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

  it("축은 미니맵 + 라벨로 정확히 쪼개진다", () => {
    expect(MINIMAP_W + AXIS_LABEL_W).toBe(AXIS_W);
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
