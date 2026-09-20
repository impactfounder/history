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
  COL_W_MIN_WIDE,
  colsForWidth,
  COLUMN_HEADER_H,
  COLUMN_HEADER_H_COMPACT,
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
    ["col-header-compact", COLUMN_HEADER_H_COMPACT],
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

  it("좁은 화면 헤더가 더 높다 — 유일하게 compact가 더 큰 치수다(두 줄이기 때문)", () => {
    expect(COLUMN_HEADER_H_COMPACT).toBeGreaterThan(COLUMN_HEADER_H);
  });

  it("두 줄이 실제로 들어간다 — 버튼 줄(HIT_MIN) + 왕조 줄(12.5×1.4) + 여백 + 밑선", () => {
    const 왕조줄 = Math.round(12.5 * 1.4);
    expect(HIT_MIN + 왕조줄 + 3).toBeLessThanOrEqual(COLUMN_HEADER_H_COMPACT);
    // 44로는 모자란다는 것이 이 값이 따로 있는 이유다
    expect(HIT_MIN + 왕조줄 + 3).toBeGreaterThan(COLUMN_HEADER_H);
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
    for (const r of ["kr", "cn", "jp", "ai", "us"]) expect(css).toMatch(new RegExp(`--region-${r}:`));
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
    for (const r of ["kr", "cn", "jp", "ai", "us"]) {
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

/**
 * **열 폭의 하한.** 규칙은 코드 주석에 "열당 150px을 지킨다"로 먼저 적혀 있었는데, 실제 구현은
 * 폰 구간(<600px) 두 breakpoint에만 있었다. AI 열이 기본이 되어 4열 → 5열이 된 뒤 600~1024px에서
 * 열이 93~178px로 눌렸고, 왕조 이름이 0px이 되고 조작 버튼이 옆 열로 넘쳤다(실측 2026-09-20).
 *
 * 아래 수는 전부 브라우저 실측에서 왔다 — 헤더 고정분 149px, 넘침이 멈추는 열 폭 153px,
 * 「조선 1392–1897」 89px · 「무로마치 시대 1336–1573」 141px.
 */
describe("colsForWidth — 열이 COL_W_MIN_WIDE 밑으로 내려가지 않는다", () => {
  /** 실제 열 폭. 격자에서 축을 빼고 열마다 CARD_GAP을 뗀다(실측 768px·5열 → 126px과 같은 식). */
  const colW = (gridW: number, n: number) => (gridW - AXIS_W - n * CARD_GAP) / n;

  it.each([600, 660, 720, 768, 820, 900, 1000, 1024, 1100, 1200, 1280, 1440, 1920])(
    "%ipx — 고른 열 수로 나눠도 열이 %s 이상이다",
    (w) => {
      const n = colsForWidth(w);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(colW(w, n), `${w}px에서 ${n}열 → 열 ${colW(w, n).toFixed(0)}px`).toBeGreaterThanOrEqual(COL_W_MIN_WIDE);
    },
  );

  it("한 열 더 넣으면 하한을 깬다 — 하한을 지키는 **최대** 열 수다", () => {
    for (const w of [768, 1024, 1280]) {
      const n = colsForWidth(w);
      expect(colW(w, n + 1), `${w}px에서 ${n + 1}열이면`).toBeLessThan(COL_W_MIN_WIDE);
    }
  });

  it("깨져 있던 구간이 실제로 줄어든다", () => {
    // 전: 전부 5열이었다. 후: 열 폭이 하한을 넘는 만큼만.
    expect(colsForWidth(768)).toBe(3);
    expect(colsForWidth(900)).toBe(3);
    expect(colsForWidth(1024)).toBe(4);
    expect(colsForWidth(1280)).toBe(5); // 흔한 노트북에서는 다섯 열이 그대로 선다
  });

  it("좁아도 최소 한 열은 남는다 — 마지막 한 열은 뺄 수 없다(§4-1)", () => {
    expect(colsForWidth(200)).toBe(1);
    expect(colsForWidth(0)).toBe(1);
    expect(colsForWidth(-100)).toBe(1);
  });

  it("폰 구간은 이 함수가 정하지 않는다 — 두 줄 헤더라 고정분이 다르다", () => {
    // 390px에서 2열(열 153px)은 손으로 검증된 값이다. 이 함수에 물리면 1열이 되어 비교가 사라진다.
    expect(colsForWidth(390)).toBe(1);
  });
});
