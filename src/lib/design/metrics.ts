/**
 * 치수 토큰의 **원본**. globals.css의 `--size-*`는 이 값의 사본이고,
 * metrics.test.ts가 둘의 일치를 강제한다 — 어느 한쪽만 고치면 `npm test`가 깨진다.
 *
 * 왜 CSS만으로 두지 못하는가: 항목 높이가 layoutCell의 배치 산수(높이 예산·시점 위치)에
 * 들어간다. 런타임 getComputedStyle로 읽으면 강제 레이아웃 + 하이드레이션 불일치가
 * 생기고, PRD §5-7의 "핀치 중 프레임당 강제 레이아웃 1회" 예산과 충돌한다.
 *
 * axis.ts와 같은 규약: 의존성 0, DOM 접근 0.
 *
 * ── 1b「카드 열」에서 바뀐 것 ──────────────────────────────────────────────
 * 위계가 3단(CHIP_H {1,2,3})에서 2단(ITEM_H {lead, plain})으로 줄었다. 등급의 축도
 * 바뀌었다 — 중요도 티어가 아니라 **UI 언어로 읽히는가**다(README §3). 티어(rank.ts)는
 * 셀 안 선별 순서와 기간 프레임 자격에만 남는다.
 *
 * 항목이 두 줄이 되었으므로(제목 + 메타) 높이가 26/22/20 → 34/28로 커졌다. 십년 레벨
 * 한 칸(80px)에 들어가는 수가 3 → 2로 줄고, 나머지는 `N건 더`로 넘어간다.
 */

/** 항목 높이(px). lead = 제목 + 메타 두 줄, plain = 원문 한 줄 + 언어 태그. */
export const ITEM_H = { lead: 34, plain: 28 } as const;
export type ItemKind = keyof typeof ITEM_H;
/**
 * 좁은 화면(<600px)의 항목 높이. 메타 줄을 접고 한 줄만 두므로 낮다.
 * 390px 폰에서 열이 2개(열당 163px)라 두 줄을 주면 한 칸에 한 건도 안 들어간다.
 */
export const ITEM_H_COMPACT = { lead: 24, plain: 20 } as const;

/**
 * 화면 폭과 포인터 종류로 항목 높이를 고른다.
 *
 * 굵은 포인터(터치)에서 **하한을 HIT_MIN으로 올린다.** 좁은 화면의 plain은 20px이라
 * WCAG 2.2 SC 2.5.8(AA)의 24px에 미달이고, 세로로 쌓이므로 중심 간격도 22px(20 + ITEM_GAP)
 * 이어서 "간격" 예외조차 못 쓴다 — 크기와 간격이 **같은 한 수치에 묶여 있다**.
 *
 * 폭이 아니라 포인터로 갈리는 이유: 좁은 데스크톱 창은 손가락이 아니라 마우스다. 거기서
 * 밀도를 깎으면 기준을 얻는 사람 없이 보이는 건수만 줄어든다. 폰은 둘 다 해당돼 24px를 받는다.
 *
 * 대가는 생각보다 작다 — 가장 자주 보는 십년 칸(80px)은 24×3 + 간격 4 = 76으로 여백
 * 76에 딱 맞아 **건수가 줄지 않는다.** 줄어드는 곳은 더 높은 행이다(100px 칸에서 4 → 3).
 * 44px(SC 2.5.5 AAA)까지는 여전히 못 가며, 그 격차는 밀도가 정보 자체인 이 화면의
 * Essential 예외로 두고 준수 대안 경로는 `/y/{year}`다.
 */
export const itemHeights = (narrow: boolean, coarse: boolean): Record<ItemKind, number> => {
  const h = narrow ? ITEM_H_COMPACT : ITEM_H;
  return coarse ? { lead: Math.max(h.lead, HIT_MIN), plain: Math.max(h.plain, HIT_MIN) } : h;
};

export const ITEM_GAP = 2;
export const CELL_PAD = 2;
/** 항목 왼쪽 여백 — 왕조 러그(3px)와 기간 레인이 들어가는 자리. */
export const ITEM_INSET_START = 14;
/** 항목 오른쪽 여백. */
export const ITEM_INSET_END = 12;

/**
 * `N건 더` 배지가 앉는 셀 아래쪽 띠의 높이. 이 띠와 겹치는 항목은 오른쪽을
 * `MORE_LANE_W`만큼 비운다 — 그러지 않으면 잘린 글줄 위에 배지가 겹쳐 찍힌다.
 */
export const MORE_BADGE_BAND = 20;
export const MORE_LANE_W = 64;
/**
 * 좁은 화면의 배지 레인. 폰에서는 배지가 「53건 더」가 아니라 숫자만이라 좁아도 된다.
 * 64px을 그대로 두면 163px 열의 절반을 먹어 제목이 「얄타 …」로 잘린다.
 */
export const MORE_LANE_W_COMPACT = 24;

/** 열 카드 헤더 높이(국기 + 나라 이름 + 그 시점의 왕조). sticky. */
export const COLUMN_HEADER_H = 44;
/**
 * 좁은 화면(<600px)의 헤더 높이. **한 줄이 아니라 두 줄**이기 때문에 더 높다.
 *
 * 실측(2026-09-13, 390px·2열이라 열 하나가 153px): 한 줄에 다 넣으면
 * 국기 20 + 나라 이름 26 + 조작 72 + 좌우 여백 24 = 142가 먼저 차서 왕조 이름에 남는 폭이
 * **0px**이었다. 「조선 1392–1897」이 통째로 잘려 사라진다 — 폰에서는 왕조 이름이 아예
 * 없었던 셈이고, 24px 타깃 이전에도 2px였으니 원래 그랬다.
 *
 * README §7-3은 `◂ ▸ ×`를 그대로 두라 하고 §7-4는 왕조 이름이 열 헤더에만 나온다고 한다.
 * 폰 폭에서 그 둘이 충돌한다. 두 줄로 나누면 **둘 다 지켜진다** — 1줄에 국기·이름·조작
 * (20+26+72+24 = 142 ≤ 153), 2줄에 왕조가 열 전폭(129px)을 받아 연도까지 들어간다.
 *
 * 52인 이유: 버튼 줄 24 + 왕조 줄 18 + 여백 6 + 밑선 3 = 51. 44로는 2px 모자란다.
 */
export const COLUMN_HEADER_H_COMPACT = 52;
/** 열 카드 사이 여백. 캔버스가 이만큼 드러나 색 없이 열이 나뉜다. */
export const CARD_GAP = 10;
export const CARD_RADIUS = 10;
/** 왕조 러그 폭. 카드 왼쪽 안쪽에 붙는다. */
export const LUG_W = 3;
/** 왕조 경계 틱 길이(러그에서 오른쪽으로). 전체 폭 실선은 글줄을 가로지른다. */
export const ERA_TICK_W = 20;

/** 시간 축 열 전체 폭 = 미니맵 + 연도 라벨. 이전 레일 64 + 거터 56 = 120을 대체한다. */
export const AXIS_W = 86;
/** 좁은 화면의 축 = 미니맵 8 + 연도 라벨 56. 390px에서 86px은 열을 너무 깎는다. */
export const AXIS_W_COMPACT = 64;
export const MINIMAP_W_COMPACT = 8;
/** 시대 미니맵 폭(축 왼쪽 끝). 축 전체를 세로로 압축해 담고, 뷰포트 창을 표시한다. */
export const MINIMAP_W = 10;
/** 연도 라벨 열 폭 = AXIS_W − MINIMAP_W. */
export const AXIS_LABEL_W = AXIS_W - MINIMAP_W;
export const AXIS_LABEL_W_COMPACT = AXIS_W_COMPACT - MINIMAP_W_COMPACT;

/**
 * **한 줄 헤더가 성립하는 최소 열 폭.**
 *
 * 헤더 한 줄의 고정분은 국기 20 + 간격 8 + 나라 이름 25 + 조작 72(24×3) + 좌우 여백 24 = 149px이고,
 * 왕조 이름은 남는 폭을 `truncate`로 받는다. 고정분은 전부 `shrink-0`이라 **줄지 않는다** —
 * 왕조가 0px이 된 뒤에도 모자라면 조작 버튼이 헤더 밖으로 밀려 옆 열을 침범한다.
 *
 * 실측(2026-09-20, 기본 5열):
 *
 * | 창 폭 | 열 폭 | 왕조 보임 | 조작 넘침 |
 * |---|---|---|---|
 * | 600 | 93 | 0 | **+60** |
 * | 768 | 126 | 0 | **+27** |
 * | 900 | 153 | 0 | 0 |
 * | 1024 | 178 | 12 | −12 |
 *
 * 153px에서 넘침이 멈추고, 왕조가 네댓 글자라도 보이려면 56px이 더 든다(「조선 1392–1897」은 89px,
 * 「무로마치 시대 1336–1573」은 141px이다). 153 + 56 = 209 → **210**.
 *
 * 이 값은 `TimelineGrid`가 이미 주석으로 적고 있던 의도("열당 150px을 지킨다")를 폭으로 옮긴 것이다.
 * 그 의도가 폰 구간(<600px)에만 하드코딩돼 있어서, AI 열이 기본이 되어 4열 → 5열이 된 뒤
 * 600~1024px에서 조용히 깨져 있었다.
 */
export const COL_W_MIN_WIDE = 210;

/**
 * 격자 폭에 **한 줄 헤더로** 들어가는 열 수. `?r=`이 없을 때의 기본 열 개수를 정한다.
 * 폰(<600px)은 두 줄 헤더라 고정분이 작고 이미 손으로 검증된 규칙이 따로 있다 — 거기엔 쓰지 않는다.
 */
export const colsForWidth = (gridW: number): number =>
  Math.max(1, Math.floor((gridW - AXIS_W) / (COL_W_MIN_WIDE + CARD_GAP)));

/** WCAG 2.2 SC 2.5.8 (AA) 최소 타깃. */
export const HIT_MIN = 24;
/** PRD §5-7 권장 타깃(SC 2.5.5 AAA). */
export const HIT_COMFORT = 44;

/** 상단바. 56 → 44. 줌 바(40)는 없앴고 그 기능은 떠 있는 컨트롤로 갔다. */
export const TOPBAR_H = 44;
/** 떠 있는 줌 컨트롤. 격자 오른쪽 아래에 absolute로 얹힌다(레이아웃 높이를 먹지 않는다). */
export const ZOOM_FLOAT_H = 34;
export const ZOOM_FLOAT_INSET = 16;
