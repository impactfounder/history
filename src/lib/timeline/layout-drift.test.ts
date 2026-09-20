import { describe, expect, it } from "vitest";

import { layoutCell } from "./layout-cell";
import type { LabelSource } from "@/lib/i18n";

/**
 * **눈금이 있으면 위치가 약속이다.**
 *
 * 대표 지적(2026-09-21): "아직 오지 않은 미래의 일이 왜 적혀 있느냐." 화면의 AI 열 2026년에
 * 10·11·12월 자리에 칩이 있었는데 **데이터에는 미래가 한 건도 없었다** — 19건이 전부 2월~9월 2일,
 * 그날(9월 21일) 이전이었다.
 *
 * 원인은 배치였다. 6·7월에 11건이 몰려 있는데 셀이 그만큼 높지 않아, 밀어내기가 6월 13일 사건을
 * **11월 자리**에, 7월 22일 사건을 **12월 자리**에 놓았다. 축이 「11월」이라 적어 둔 자리에 칩이
 * 있으면 사용자는 그것을 11월의 일로 읽는다 — 그리고 그 판단이 옳다. 화면이 거짓말을 한 것이다.
 *
 * 그래서 **눈금 하나**가 한계다. 그보다 밀릴 항목은 `+N`으로 보낸다 — 배지를 누르면 그 칸의
 * 전부가 시트에 뜨므로(CellSheet, 2026-09-20) 숨긴다고 잃는 것이 아니다.
 */
const ev = (y0: number, m: number, id: string): LabelSource & { y0: number; m: number; id: string } => ({
  id,
  y0,
  m,
  title: `사건 ${id}`,
  name_ko: `사건 ${id}`,
  lang: "ko",
  names: {},
});

/** 한 해가 480px — 축이 월 눈금을 그리는 높이(240px 이상). 눈금 하나 = 40px. */
const H = 480;
const TICKS = 12;

describe("눈금이 있으면 눈금 하나보다 더 밀지 않는다", () => {
  /** 6월에 여덟 건 — 실제 데이터(2026년 6·7월 11건)의 축소판이다. */
  const crowded = Array.from({ length: 8 }, (_, i) => ev(2026, 6, `c${i}`));

  it("한계가 없으면 뒤 항목이 몇 달씩 밀린다", () => {
    const { placed } = layoutCell(crowded, H, 2026, 1, "ko", undefined, undefined, 0);
    const last = placed[placed.length - 1]!;
    const wantTop = ((6 - 1) / 12) * H; // 6월의 자리
    expect(placed.length).toBeGreaterThan(2);
    expect(last.top - wantTop).toBeGreaterThan(H / 12); // 한 달보다 많이 밀렸다
  });

  it("한계가 있으면 어느 것도 눈금 하나를 넘겨 밀리지 않는다", () => {
    const { placed } = layoutCell(crowded, H, 2026, 1, "ko", undefined, undefined, TICKS);
    const wantTop = ((6 - 1) / 12) * H;
    for (const p of placed) expect(p.top - wantTop).toBeLessThanOrEqual(H / TICKS + 1);
  });

  it("밀려난 것은 사라지지 않고 +N으로 간다", () => {
    const { placed, hidden } = layoutCell(crowded, H, 2026, 1, "ko", undefined, undefined, TICKS);
    expect(placed.length + hidden).toBe(crowded.length);
    expect(hidden).toBeGreaterThan(0);
  });

  /**
   * **뒤 항목을 버리지 않는다.** 한계에 걸린 항목에서 멈추면(`break`) 그보다 늦은 달의 사건이
   * 자리가 비어 있는데도 통째로 사라진다. 그래서 건너뛰고(`continue`) 계속 본다.
   */
  it("앞이 붐벼도 뒤의 다른 달은 제자리에 놓인다", () => {
    const mixed = [...Array.from({ length: 8 }, (_, i) => ev(2026, 6, `c${i}`)), ev(2026, 11, "nov")];
    const { placed } = layoutCell(mixed, H, 2026, 1, "ko", undefined, undefined, TICKS);
    const nov = placed.find((p) => (p.ev as { id: string }).id === "nov");
    expect(nov, "11월 사건이 자리가 있는데도 사라졌다").toBeDefined();
    const wantNov = ((11 - 1) / 12) * H;
    expect(Math.abs(nov!.top - wantNov)).toBeLessThanOrEqual(H / TICKS + 1);
  });
});

describe("눈금이 없으면 한계도 없다", () => {
  /**
   * 축이 월을 적지 않으면 그만한 정밀도를 약속하지 않은 것이다. 그때까지 밀어내기를 막으면
   * 붐비는 세기·십년 칸에서 볼 수 있는 항목만 줄어든다.
   */
  it("ticks 0이면 예전처럼 채운다", () => {
    const many = Array.from({ length: 8 }, (_, i) => ev(1900, 1, `d${i}`));
    const withLimit = layoutCell(many, H, 1900, 100, "ko", undefined, undefined, 12);
    const noLimit = layoutCell(many, H, 1900, 100, "ko", undefined, undefined, 0);
    expect(noLimit.placed.length).toBeGreaterThanOrEqual(withLimit.placed.length);
  });

  it("기본값은 한계 없음 — 넘기지 않는 호출부를 바꾸지 않는다", () => {
    const many = Array.from({ length: 6 }, (_, i) => ev(2026, 3, `e${i}`));
    expect(layoutCell(many, H, 2026, 1, "ko").placed.length).toBe(
      layoutCell(many, H, 2026, 1, "ko", undefined, undefined, 0).placed.length,
    );
  });
});
