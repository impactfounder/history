/**
 * 셀 안 배치 — TimelineGrid.tsx의 layoutCell을 대체한다.
 *
 * 기존 규칙은 그대로 남는다:
 *   1) 중요도 순(청크 순서)으로 높이 예산에 들어갈 만큼 고른다 — 개수 상한이 아니라 높이 상한
 *   2) 고른 것을 시간 순으로 실제 시점 위치(연·월 오프셋)에 놓고, 앞 항목과 겹치면 아래로 민다
 *
 * 1b에서 더한 것:
 *   3) 높이가 티어(26/22/20)가 아니라 **등급**(lead 34 / plain 28)에서 나온다
 *   4) `N건 더` 배지가 앉는 아래쪽 20px 띠와 겹치는 항목은 오른쪽을 64px 비운다.
 *      이 한 줄이 없으면 잘린 글줄 위에 배지가 겹쳐 찍혀 "…guerrillas in the.3건 더"처럼 읽힌다.
 *
 * 순수 함수 — 같은 입력에 같은 출력. DOM 접근 0.
 */

import { CELL_PAD, ITEM_GAP, ITEM_H, MORE_BADGE_BAND, MORE_LANE_W } from "@/lib/design/metrics";
import { itemKind, type KindSource } from "@/lib/timeline/item-kind";
import type { Locale } from "@/lib/i18n";

export interface PlacedItem<T> {
  ev: T;
  kind: "lead" | "plain";
  top: number;
  h: number;
  /** 오른쪽 여백. 배지 띠와 겹치는 항목만 MORE_LANE_W. */
  laneEnd: number;
}

export interface CellLayout<T> {
  placed: PlacedItem<T>[];
  hidden: number;
}

/**
 * @param evs   그 칸의 사건. 청크 순서(중요도 desc → 언어판 수 desc)를 유지한 상태여야 한다.
 * @param h     행 높이(px) = 행 단위 × s
 * @param b     행 버킷의 시작 연도
 * @param unit  행 단위(연) — 세기 100 · 십년 10 · 연도 1
 */
export function layoutCell<T extends KindSource & { y0: number; m?: number }>(
  evs: T[],
  h: number,
  b: number,
  unit: number,
  locale: Locale,
): CellLayout<T> {
  const avail = h - CELL_PAD * 2;

  // 1) 높이 예산
  const chosen: { ev: T; kind: "lead" | "plain"; h: number }[] = [];
  let used = 0;
  for (const ev of evs) {
    const kind = itemKind(ev, locale);
    const ih = ITEM_H[kind];
    if (used + ih > avail) break;
    chosen.push({ ev, kind, h: ih });
    used += ih + ITEM_GAP;
  }

  // 2) 시점 위치
  const at = (ev: T) => ev.y0 + ((ev.m ?? 1) - 1) / 12;
  chosen.sort((a, c) => at(a.ev) - at(c.ev));

  const placed: PlacedItem<T>[] = [];
  let cursor = CELL_PAD;
  for (const it of chosen) {
    const want = CELL_PAD + ((at(it.ev) - b) / unit) * h;
    const top = Math.max(cursor, Math.min(want, h - CELL_PAD - it.h));
    if (top + it.h > h - CELL_PAD) break;
    placed.push({ ev: it.ev, kind: it.kind, top, h: it.h, laneEnd: 0 });
    cursor = top + it.h + ITEM_GAP;
  }

  const hidden = evs.length - placed.length;

  // 3) 배지 레인 — 숨은 것이 있을 때만, 아래쪽 띠와 겹치는 항목에만
  if (hidden > 0) {
    for (const p of placed) {
      if (p.top + p.h > avail - MORE_BADGE_BAND) p.laneEnd = MORE_LANE_W;
    }
  }

  return { placed, hidden };
}
