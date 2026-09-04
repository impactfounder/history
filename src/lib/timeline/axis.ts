// history 시간축 좌표계 — PRD §5-5A의 구현부.
//
// 의존성 0, DOM 접근 0. 그리드의 모든 위치 계산이 여기서만 나온다:
// 스크롤 ↔ 연도, 줌 앵커, 보이는 행, 시대 레일, 청크 키, 행 라벨.
//
// 왜 한 파일에 몰아넣는가: 0.4에서 시간 이동을 네이티브 스크롤에 맡기면서
// 좌표 변환이 컴포넌트 안으로 스며들기 쉬워졌다. 스며드는 순간 vitest로
// 검증할 수 없게 되고, 줌 앵커처럼 눈으로는 "대충 맞아 보이는" 버그를
// 잡지 못한다. suite/packages/work-core/src/core.ts와 같은 규약을 따른다 —
// 자립 단일 파일, 구조 타입, 대칭 API.
//
// 축 내부 계산은 전부 천문학적 연수다(1 BC = 0). 사람이 읽는 문자열은
// formatRowLabel 하나에서만 만든다(data-model §3-4).

// ─────────────────────────────────────────────────────────────────────────────
// 도메인 상수
// ─────────────────────────────────────────────────────────────────────────────

/** 기원전 500년. 천문학적 연수이므로 −499다. */
export const AXIS_YEAR_START = -499;
/** 수록 끝. §11 C-2에서 컷오프가 정해지면 함께 조정한다. */
export const AXIS_YEAR_END = 2026;
/** 양끝 포함 연수. 2,526년. */
export const AXIS_SPAN_YEARS = AXIS_YEAR_END - AXIS_YEAR_START + 1;

/** 의미 레벨 경계 (px/년). PRD §5-3 표. */
export const S_DECADE = 4;
export const S_YEAR = 40;
export const S_MONTH = 400;
/**
 * P0 스케일 상한 — 월 레벨(P1) 진입 직전. PRD §5-5A 총 높이 표의 "연도 상한".
 * P1에서 월 레벨을 열 때 이 상수를 지운다.
 */
export const S_P0_MAX = 399;

export type Level = "century" | "decade" | "year" | "month";

/** 레벨별 행 단위(연). 월은 P1이며 정수 연이 아니다. */
export const ROW_UNIT: Record<Level, number> = {
  century: 100,
  decade: 10,
  year: 1,
  month: 1 / 12,
};

/**
 * 축의 상태. `s`는 1년당 픽셀, `viewportH`는 스크롤 컨테이너의 clientHeight다.
 * 상단바·줌 바 같은 고정 크롬은 이미 빠진 값이다(PRD §5-7 세로 브레이크포인트).
 */
export interface Axis {
  s: number;
  viewportH: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 기본 변환
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 상하 여백. 첫 해와 마지막 해도 화면 중앙에 올 수 있어야 하므로 뷰포트의 절반씩 둔다.
 * `s`에 무관하다 — 줌 앵커 수식에서 이 성질을 쓴다.
 */
export function padTop(a: Axis): number {
  return a.viewportH / 2;
}

/** 스페이서 높이. */
export function contentHeight(a: Axis): number {
  return AXIS_SPAN_YEARS * a.s + a.viewportH;
}

/** 스크롤 가능한 최대 위치. `contentHeight − viewportH`와 같다. */
export function maxScrollTop(a: Axis): number {
  return AXIS_SPAN_YEARS * a.s;
}

/** 연도 → 스페이서 안의 y좌표. */
export function yearToY(year: number, a: Axis): number {
  return (year - AXIS_YEAR_START) * a.s + padTop(a);
}

/** 스페이서 안의 y좌표 → 연도. `yearToY`의 역함수. */
export function yToYear(y: number, a: Axis): number {
  return (y - padTop(a)) / a.s + AXIS_YEAR_START;
}

/**
 * 지금 보이는 연도 범위. **축 범위로 clamp된다** — 상하 여백 구간에서는
 * 축 밖 연도가 나오는데, 렌더·프리페치에는 축 안의 값만 필요하다.
 * 시대 레일은 clamp하지 않은 값을 써야 하므로 railWindow가 따로 계산한다.
 */
export function visibleYears(scrollTop: number, a: Axis): { from: number; to: number } {
  const from = yToYear(scrollTop, a);
  const to = yToYear(scrollTop + a.viewportH, a);
  return {
    from: clamp(from, AXIS_YEAR_START, AXIS_YEAR_END),
    to: clamp(to, AXIS_YEAR_START, AXIS_YEAR_END),
  };
}

/** 뷰포트 중앙 연도. URL의 `y=` 파생값이며 상태가 아니다(PRD §5-5). */
export function centerYear(scrollTop: number, a: Axis): number {
  return yToYear(scrollTop + a.viewportH / 2, a);
}

/** 그 해를 화면 중앙에 놓는 scrollTop. 연도 점프·URL 복원용. */
export function scrollTopForYear(year: number, a: Axis): number {
  return clamp((year - AXIS_YEAR_START) * a.s, 0, maxScrollTop(a));
}

// ─────────────────────────────────────────────────────────────────────────────
// 의미 레벨과 행 버킷
// ─────────────────────────────────────────────────────────────────────────────

export function levelOf(s: number): Level {
  if (s < S_DECADE) return "century";
  if (s < S_YEAR) return "decade";
  if (s < S_MONTH) return "year";
  return "month";
}

/** 레벨이 차지하는 스케일 구간 `[lo, hi)`. PRD §5-3 표. */
export const LEVEL_BAND: Record<Level, [number, number]> = {
  century: [0, S_DECADE],
  decade: [S_DECADE, S_YEAR],
  year: [S_YEAR, S_MONTH],
  month: [S_MONTH, Infinity],
};

/** 경계에서 왕복할 때 크로스페이드가 깜빡이지 않도록 두는 이력. PRD §5-3. */
export const LEVEL_HYSTERESIS = 0.05;

/**
 * 이력을 둔 레벨 판정. 지금 레벨의 구간을 `margin`만큼 넓혀서, 그 안에 있는
 * 동안은 버틴다.
 *
 * 왜: 경계값(4·40·400) 근처에서 손가락이 조금만 흔들려도 `levelOf`는
 * 레벨을 왕복시키고, 그때마다 행 단위가 바뀌면서 크로스페이드가 깜빡인다.
 * 좌표 변환은 레벨에 의존하지 않으므로(§5-5A) 이력을 둬도 위치는 틀어지지
 * 않는다 — 행을 어떻게 묶어 보여줄지만 늦게 바뀔 뿐이다.
 *
 * `prev`가 null이면(첫 렌더·URL 복원) 이력 없이 판정한다.
 */
export function levelWithHysteresis(
  s: number,
  prev: Level | null,
  margin: number = LEVEL_HYSTERESIS,
): Level {
  const next = levelOf(s);
  if (prev === null || prev === next) return next;
  const [lo, hi] = LEVEL_BAND[prev];
  return s >= lo * (1 - margin) && s < hi * (1 + margin) ? prev : next;
}

/**
 * 스케일 하한·상한.
 *
 * - `min`: 축 전체가 한 화면에 들어오는 스케일. 그 아래로 내려가면 축 밖
 *   빈 공간만 늘어난다.
 * - `max`: **가장 깊은 레벨의 행 높이가 뷰포트를 넘지 않는 지점.** PRD §5-5A는
 *   "행 단위 u × s ≤ gridH"라고 썼는데, 이 규칙을 중간 레벨에 그대로 걸면
 *   세로가 짧은 창에서 십년 레벨 상한이 40 px/년 아래로 내려가 연도 레벨로
 *   넘어갈 수 없게 된다. 중간 레벨은 더 확대하면 스스로 풀리므로, 규칙은
 *   더 확대할 곳이 없는 최심 레벨(P0에서는 연도, u=1)에만 적용한다.
 */
export function scaleBounds(viewportH: number): { min: number; max: number } {
  return {
    min: viewportH / AXIS_SPAN_YEARS,
    max: Math.min(viewportH, S_P0_MAX),
  };
}

export function clampScale(s: number, viewportH: number): number {
  const b = scaleBounds(viewportH);
  return clamp(s, b.min, b.max);
}

/** 균일 floor 버킷. 원점은 0이다(data-model §3-4). */
export function bucketStart(year: number, unit: number): number {
  return Math.floor(year / unit) * unit;
}

/**
 * 지금 렌더해야 할 행 범위. `from`·`to`는 버킷의 시작 연도다.
 * 이 출력에서 프리페치할 청크 키가 나온다(`chunkKeyFor`).
 *
 * `level`을 넘기면 그것을 쓴다 — 히스테리시스로 붙잡아 둔 레벨을 그대로
 * 반영하기 위해서다. 생략하면 스케일에서 바로 판정한다.
 */
export function visibleRows(
  scrollTop: number,
  a: Axis,
  level: Level = levelOf(a.s),
): { level: Level; unit: number; from: number; to: number } {
  if (level === "month") {
    throw new Error("월 레벨은 P1이다(PRD §4-2). 행 버킷이 정의되어 있지 않다.");
  }
  const unit = ROW_UNIT[level];
  const { from, to } = visibleYears(scrollTop, a);
  return { level, unit, from: bucketStart(from, unit), to: bucketStart(to, unit) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 줌
// ─────────────────────────────────────────────────────────────────────────────

// 호출부 공통 주의: 스페이서 height를 쓴 **뒤 같은 레이아웃 패스 안에서**
// 결과를 scrollTop에 대입해야 한 프레임도 튀지 않는다(useLayoutEffect).

/**
 * 앵커가 가리키는 연도. 제스처가 시작될 때 한 번 구해 두고 끝까지 들고 다닌다.
 */
export function anchorYearAt(scrollTop: number, anchorOffsetY: number, a: Axis): number {
  return yToYear(scrollTop + anchorOffsetY, a);
}

/**
 * 앵커 **연도**를 직접 받아 scrollTop을 낸다. 줌 제스처는 이 함수를 써야 한다.
 *
 * 왜: 브라우저가 scrollTop을 기기 픽셀 격자(1/DPR)에 스냅한다(Chrome 152 실측,
 * DPR 1.25에서 격자 0.8px — PRD §11 C-11). 매 프레임 "스냅된 scrollTop → 앵커 연도"를 다시
 * 읽으면 그 오차가 다음 프레임의 입력이 되고, 확대할 때 sNext/s 배로 증폭돼
 * 제스처를 오래 끌수록 앵커가 흘러간다. 앵커 연도를 제스처 시작 시점에
 * 한 번만 정하면 누적이 원천적으로 사라진다.
 */
export function zoomToYear(
  anchorYear: number,
  anchorOffsetY: number,
  sNext: number,
  viewportH: number,
): number {
  const next = (anchorYear - AXIS_YEAR_START) * sNext + viewportH / 2 - anchorOffsetY;
  return clamp(next, 0, maxScrollTop({ s: sNext, viewportH }));
}

/**
 * 스케일이 `s` → `sNext`로 바뀔 때 앵커 아래 연도를 고정하는 scrollTop.
 * **단발 줌(더블클릭·줌 바·`+`/`−` 키)용이다.** 휠·핀치처럼 연속으로 이어지는
 * 제스처는 `anchorYearAt` + `zoomToYear` 조합을 써서 반올림 누적을 피한다.
 */
export function zoomAt(
  scrollTop: number,
  anchorOffsetY: number,
  s: number,
  sNext: number,
  viewportH: number,
): number {
  // 단발 줌(더블클릭·줌 바·키보드)용. 연속 제스처는 zoomToYear를 쓴다.
  const year = anchorYearAt(scrollTop, anchorOffsetY, { s, viewportH });
  return zoomToYear(year, anchorOffsetY, sNext, viewportH);
}

// ─────────────────────────────────────────────────────────────────────────────
// 시대 레일 (= 네이티브 스크롤바 대체, PRD §5-10)
// ─────────────────────────────────────────────────────────────────────────────

/** 레일 창의 최소 높이. 연도 레벨에서는 이론 높이가 1px 미만이 된다. */
export const RAIL_MIN_THUMB_PX = 8;

/**
 * 연도 → 레일 안의 y좌표. **연도 도메인 선형 매핑이다.**
 *
 * 상하 여백이 대칭(viewportH/2)인 지금 규약에서는 스크롤 비율
 * `scrollTop / (contentHeight − viewportH)`도 수치적으로는 같은 값이 된다.
 * 다만 그 비율이 가리키는 것은 뷰포트 **상단**이 아니라 **중앙 연도**이고,
 * 여백 규약이 바뀌면 즉시 깨진다. 레일은 연도 도메인으로 매핑한다.
 */
export function railY(year: number, railHeight: number): number {
  return ((year - AXIS_YEAR_START) / AXIS_SPAN_YEARS) * railHeight;
}

/**
 * 레일 위의 뷰포트 창. 스크롤바 썸과 같은 역할이다.
 * `visibleYears`와 달리 축 범위로 clamp하지 않는다 — clamp하면 축 양끝에서
 * 창이 쪼그라들어 스크롤바로서 거짓말을 하게 된다.
 */
export function railWindow(
  scrollTop: number,
  a: Axis,
  railHeight: number,
  minThumbPx: number = RAIL_MIN_THUMB_PX,
): { top: number; height: number } {
  const y0 = yToYear(scrollTop, a);
  const y1 = yToYear(scrollTop + a.viewportH, a);
  let top = railY(y0, railHeight);
  let height = railY(y1, railHeight) - top;
  if (height < minThumbPx) {
    top -= (minThumbPx - height) / 2; // 중앙을 유지한 채 넓힌다
    height = minThumbPx;
  }
  return { top: clamp(top, 0, Math.max(0, railHeight - height)), height };
}

// ─────────────────────────────────────────────────────────────────────────────
// 발행 청크와 표시 문자열
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 행 버킷 → 발행 청크 키. **파일 단위는 행 단위보다 한 자릿수 크다**
 * (data-model §6-1) — 네이티브 관성 스크롤이 축을 빠르게 훑기 때문이다.
 *
 * 기원전 버킷의 키는 음수 그대로다(`decade/-500`). 천문학적 연수를 그대로
 * 쓰는 편이 변환 실수를 막는다. 사람이 읽는 문자열은 formatRowLabel이 만든다.
 */
export function chunkKeyFor(bucket: number, level: Level): string {
  switch (level) {
    case "century":
      return "century/all";
    case "decade":
      return `decade/${bucketStart(bucket, 100)}`;
    case "year":
      return `year/${bucketStart(bucket, 10)}`;
    case "month":
      throw new Error("월 레벨 청크는 P1에서 정의한다(data-model §6-1).");
  }
}

/**
 * 행 라벨. 표시 문자열의 단일 출처다(data-model §3-4).
 *
 * 버킷은 균일 floor를 유지하고 라벨만 고친다. 그 대가로 기원전 세기 버킷은
 * "기원전 500년대"라는 이름과 범위가 어긋나므로 **범위 표기**를 쓰고,
 * 기원전과 서기가 한 버킷에 걸치는 이음매 `[0, 99]`도 그대로 드러낸다.
 */
export function formatRowLabel(bucket: number, level: Level): string {
  if (level === "month") {
    throw new Error("월 레벨 라벨은 P1에서 정의한다.");
  }
  const unit = ROW_UNIT[level];
  const end = bucket + unit - 1;

  if (bucket >= 1) {
    return unit === 1 ? `${bucket}년` : `${bucket}년대`;
  }
  if (end <= 0) {
    return unit === 1
      ? `기원전 ${1 - bucket}년`
      : `기원전 ${1 - bucket}–${1 - end}년`;
  }
  return `기원전 ${1 - bucket}년–서기 ${end}년`;
}

/** 단일 연도 표시. data-model §3-4의 연도 규칙. */
export function formatYear(year: number): string {
  return year <= 0 ? `기원전 ${1 - year}년` : `${year}년`;
}
