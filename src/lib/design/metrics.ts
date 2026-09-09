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

/** WCAG 2.2 SC 2.5.8 (AA) 최소 타깃. */
export const HIT_MIN = 24;
/** PRD §5-7 권장 타깃(SC 2.5.5 AAA). */
export const HIT_COMFORT = 44;

/** 상단바. 56 → 44. 줌 바(40)는 없앴고 그 기능은 떠 있는 컨트롤로 갔다. */
export const TOPBAR_H = 44;
/** 떠 있는 줌 컨트롤. 격자 오른쪽 아래에 absolute로 얹힌다(레이아웃 높이를 먹지 않는다). */
export const ZOOM_FLOAT_H = 34;
export const ZOOM_FLOAT_INSET = 16;
