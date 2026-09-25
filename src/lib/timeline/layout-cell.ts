/**
 * 셀 안 배치 — TimelineGrid.tsx의 layoutCell을 대체한다.
 *
 * 기존 규칙은 그대로 남는다:
 *   1) 중요도 순(청크 순서)으로 높이 예산에 들어갈 만큼 고른다 — 개수 상한이 아니라 높이 상한
 *   2) 고른 것을 시간 순으로 실제 시점 위치(연·월 오프셋)에 놓고, 앞 항목과 겹치면 아래로 민다
 *      — 단 **눈금 하나보다 더 밀리면 그리지 않는다**(아래 `ticks`)
 *
 * 1b에서 더한 것:
 *   3) 높이가 티어(26/22/20)가 아니라 **등급**(lead 34 / plain 28)에서 나온다
 *   4) `N건 더` 배지가 앉는 아래쪽 20px 띠와 겹치는 항목은 오른쪽을 64px 비운다.
 *      이 한 줄이 없으면 잘린 글줄 위에 배지가 겹쳐 찍혀 "…guerrillas in the.3건 더"처럼 읽힌다.
 *
 * 순수 함수 — 같은 입력에 같은 출력. DOM 접근 0.
 */

import { CELL_PAD, ITEM_GAP, ITEM_H, ITEM_H_COMPACT, MORE_BADGE_BAND, MORE_LANE_W } from "@/lib/design/metrics";
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
 * @param heights 항목 높이표. 좁은 화면은 메타 줄을 접으므로 ITEM_H_COMPACT를 넘긴다.
 * @param laneW   배지 레인 폭. 좁은 화면은 배지가 숫자뿐이라 MORE_LANE_W_COMPACT.
 * @param ticks   이 행에 그려지는 눈금 수(연도 행의 월 12 · 십년 행의 해 10). 0이면 눈금이 없다.
 * @param total   칸의 **총** 사건 수. 기본은 `evs.length`다. 십년 청크는 앞부분만 먼저 오므로(publish.mjs)
 *                받은 것이 다 서도 뒤에 더 있을 수 있다 — 그러면 「N건 더」와 배지 자리가 있어야 한다.
 *
 * **눈금이 있으면 위치가 약속이 된다.** 축이 「6월」이라 적어 둔 자리에 칩이 있으면 사용자는
 * 그 사건이 6월의 일이라고 읽는다 — 그것이 이 제품의 전제다.
 *
 * 그런데 2)의 밀어내기는 그 약속을 깬다. 실측(2026-09-21, 대표 지적 "아직 오지 않은 미래의 일이
 * 왜 적혀 있느냐"): AI 열 2026년 19건이 6·7월에 몰려 있어, 6월 13일 사건이 **11월 자리**에,
 * 7월 22일 사건이 **12월 자리**에 그려졌다. 데이터에는 미래가 한 건도 없었다 — 화면만 그렇게
 * 보인 것이고, 그 화면을 믿으면 "아직 안 일어난 일이 적혀 있다"가 된다.
 *
 * 그래서 **눈금 하나**를 한계로 둔다. 그보다 밀릴 항목은 그리지 않고 `+N`으로 보낸다 —
 * 배지를 누르면 그 칸의 전부가 시트에 뜨므로(CellSheet) 숨긴다고 잃는 것이 아니다.
 * 눈금이 없으면(`ticks === 0`) 축이 그만한 정밀도를 약속하지 않으므로 한계도 없다.
 */
export function layoutCell<T extends KindSource & { y0: number; m?: number }>(
  evs: T[],
  h: number,
  b: number,
  unit: number,
  locale: Locale,
  heights: Record<"lead" | "plain", number> = ITEM_H,
  laneW: number = MORE_LANE_W,
  ticks = 0,
  total: number = evs.length,
): CellLayout<T> {
  const avail = h - CELL_PAD * 2;

  // 1) 높이 예산
  const chosen: { ev: T; kind: "lead" | "plain"; h: number }[] = [];
  let used = 0;
  for (const ev of evs) {
    let kind = itemKind(ev, locale);
    /*
      **칸의 첫 항목은 등급을 낮춰서라도 세운다**(2026-09-26, 대표 지적 "가장 줄이면 하나도 안 나오는 게 맞아?").
      가장 줄인 화면의 세기 행은 34px, 쓸 자리는 30px다. 칸의 맨 앞(가장 중요한 것)은 대개 lead(34px)라
      여기서 곧장 멈췄고, 28px plain이면 설 자리가 있는데도 **모든 칸이 「N건 더」뿐**이었다.
      등급은 자리가 허락할 때의 강조다 — 자리가 모자라 강조를 잃는 것이 사건 자체를 잃는 것보다 낫다.
      첫 항목만: 뒤 항목까지 낮추면 넓은 칸에서도 lead가 plain으로 섞여 위계가 흐려진다.
    */
    if (!chosen.length && kind === "lead" && heights.lead > avail && heights.plain <= avail) kind = "plain";
    let ih = heights[kind];
    /*
      그래도 안 들어가면 **첫 항목만** 한 줄 칩의 바닥 높이(ITEM_H_COMPACT.plain 20px)까지 낮춘다(2026-09-26 줌 점검).
      폰은 터치라 plain이 24px(HIT_MIN)인데 가장 줄인 세기 행이 약 24px(쓸 자리 20px)라, 폰 화면만 칸마다
      숫자 배지뿐이었다. 20px 칩은 SC 2.5.8의 크기(24px)엔 못 미치지만 행 간격이 24px 이상이라 **간격 예외**
      (대상 중심 간 24px)에 든다. 이 높이의 칩은 메타 줄을 싣지 않는다(TimelineGrid가 ih로 가른다).
    */
    if (!chosen.length && ih > avail && ITEM_H_COMPACT.plain <= avail) {
      kind = "plain";
      ih = ITEM_H_COMPACT.plain;
    }
    if (used + ih > avail) break;
    chosen.push({ ev, kind, h: ih });
    used += ih + ITEM_GAP;
  }

  // 2) 시점 위치
  const at = (ev: T) => ev.y0 + ((ev.m ?? 1) - 1) / 12;
  chosen.sort((a, c) => at(a.ev) - at(c.ev));

  /** 눈금 하나만큼은 밀려도 된다. 눈금이 없으면 한계도 없다(축이 약속하지 않았다). */
  const drift = ticks > 0 ? h / ticks : Infinity;

  const placed: PlacedItem<T>[] = [];
  let cursor = CELL_PAD;
  for (const it of chosen) {
    const want = CELL_PAD + ((at(it.ev) - b) / unit) * h;
    const top = Math.max(cursor, Math.min(want, h - CELL_PAD - it.h));
    if (top + it.h > h - CELL_PAD) break;
    // 눈금 하나보다 더 밀렸다 — 그 자리는 이 사건의 시간이 아니다. `+N`으로 보낸다.
    // `break`가 아니라 `continue`다: 뒤 항목은 want가 더 아래라 제자리에 놓일 수 있다.
    if (top - want > drift) continue;
    placed.push({ ev: it.ev, kind: it.kind, top, h: it.h, laneEnd: 0 });
    cursor = top + it.h + ITEM_GAP;
  }

  // 받은 것보다 칸이 더 가졌을 수 있다 — 십년 청크의 뒷부분을 아직 안 받은 때(publish.mjs)
  const hidden = Math.max(total, evs.length) - placed.length;

  // 3) 배지 레인 — 숨은 것이 있을 때만, 아래쪽 띠와 겹치는 항목에만
  if (hidden > 0) {
    for (const p of placed) {
      if (p.top + p.h > avail - MORE_BADGE_BAND) p.laneEnd = laneW;
    }
  }

  return { placed, hidden };
}
