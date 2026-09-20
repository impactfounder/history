"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AXIS_SPAN_YEARS,
  AXIS_YEAR_END,
  AXIS_YEAR_START,
  anchorYearAt,
  bucketStart,
  centerYear,
  chunkKeyFor,
  clampScale,
  contentHeight,
  formatRowLabel,
  formatYear,
  levelOf,
  levelWithHysteresis,
  railWindow,
  railY,
  scaleBounds,
  scrollTopForYear,
  visibleRows,
  yToYear,
  yearToY,
  zoomToYear,
  type Axis,
  type Level,
} from "@/lib/timeline/axis";
import { assignLanes, baseTier, SPAN_MIN_PX } from "@/lib/timeline/rank";
import type { SearchHit } from "@/lib/search";
import { layoutCell } from "@/lib/timeline/layout-cell";
import { originalTag } from "@/lib/timeline/item-kind";
import {
  colsForWidth,
  AXIS_LABEL_W,
  AXIS_LABEL_W_COMPACT,
  CARD_GAP,
  CELL_PAD,
  COLUMN_HEADER_H,
  COLUMN_HEADER_H_COMPACT,
  ERA_TICK_W,
  HIT_COMFORT,
  HIT_MIN,
  itemHeights,
  ITEM_INSET_END,
  ITEM_INSET_START,
  LUG_W,
  MINIMAP_W,
  MINIMAP_W_COMPACT,
  MORE_LANE_W,
  MORE_LANE_W_COMPACT,
  TOPBAR_H,
  ZOOM_FLOAT_INSET,
} from "@/lib/design/metrics";
import { LOCALES, LOCALE_LABEL, LOCALE_REGION, REGION_LABEL, T, dupNames, eventLabel, formatRowLabelL, formatYearL, isEventName, isLocale, localePath, nameIn, type Locale } from "@/lib/i18n";
import { SearchOverlay } from "./SearchOverlay";
import { ThemeToggle } from "./ThemeToggle";

/**
 * 존재하는 열 전부. `COLUMNS`는 "있는 열", `DEFAULT_COLS`는 "처음 보이는 열"로 뜻이 다르다 —
 * 지금은 같지만, 열을 늘리면서 기본을 그대로 두고 싶을 때 이 구분이 필요하다.
 *
 * **ai가 맨 앞이다**(대표 결정 2026-09-20, "AI & Human History"). AI의 역사를 인류사와
 * 같은 축에 놓는 것이 이 제품의 주장이 되었고, 주장은 첫 열에 선다.
 */
const COLUMNS = [
  { id: "ai", label: "AI" },
  { id: "kr", label: "한국" },
  { id: "cn", label: "중국" },
  { id: "jp", label: "일본" },
  { id: "us", label: "미국" },
] as const;
type RegionId = (typeof COLUMNS)[number]["id"];
/**
 * 처음 보이는 열과 그 순서. 좁은 화면은 여기서 `slice(0, 1|2)`로 앞쪽을 남기므로
 * 폰에서는 AI·한국 두 열이 된다.
 */
const DEFAULT_COLS: readonly RegionId[] = ["ai", "kr", "cn", "jp", "us"];

/** 셀당 최대 칩 수(PRD §5-3). 넘치면 `+N`. */
/**
 * 발행 데이터에 티어가 아직 안 붙은 경우(첫 페인트)의 폴백.
 * 티어는 이제 **글자 크기에 쓰지 않는다**(그건 itemKind가 맡는다). 남은 쓰임은 둘 —
 * 셀 안 선별 순서(청크 정렬)와 기간 프레임 자격("티어 3은 프레임을 갖지 못한다").
 */

/** 행 안 보조선: 십년 행은 연 단위, 연도 행은 월 단위. 행이 이만큼 높을 때만(선 사이 20px 이상). */
const subdivisions = (level: Level, h: number): number => (level === "decade" && h >= 200 ? 10 : level === "year" && h >= 240 ? 12 : 0);
/** 하단 줌 바의 레벨 정류장(§5-3 경계 4·40 안쪽의 대표 스케일). */
const LEVEL_STOPS: { level: Level; s: number; label: string }[] = [
  { level: "century", s: 2, label: "세기" },
  { level: "decade", s: 8, label: "십년" },
  { level: "year", s: 40, label: "연도" },
];
/** 뷰포트 밖으로 더 그리는 행 수. 관성 스크롤의 지연을 흡수한다. */
const OVERSCAN_ROWS = 3;
/** 제스처가 끝났다고 보는 유휴 시간(ms). 이후 앵커 연도를 새로 잡는다. */
const GESTURE_IDLE_MS = 180;

// ── 발행 포맷 (data-model §6-2) ──────────────────────────────────────────────
interface PublishedEvent {
  id: string;
  y0: number;
  /** 월(1~12). 원문에 표기가 있을 때만. 행 안 배치의 시점 오프셋에 쓴다. */
  m?: number;
  /** 기간 사건의 끝 연도(원문 범위 또는 위키데이터 P582). 있으면 기간 막대. */
  y1?: number;
  approx: boolean;
  hist: "historical" | "traditional";
  title: string;
  /** 기계 번역(tools/translate.mjs). 있으면 칩에 이것을 보인다. */
  title_ko?: string;
  /** 지은 제목(tools/name.mjs). 원문 표제어가 사건 꼴이 아닐 때 칩 라벨이 된다. */
  name_ko?: string;
  /** 연결 문서의 짧은 설명("일본의 무장") — 칩 툴팁. */
  desc?: string;
  /** 위키데이터 구조 라벨. "accession" = 재위 시작 — 라벨에 언어별 "즉위"가 붙는다. */
  role?: string;
  lang: string;
  names: Partial<Record<RegionId, { nat?: string; lang?: string }>>;
  regions: { r: RegionId; imp: number; role: string }[];
  date_ko: string;
  /** 국사편찬위 연표에 맞춰진 공식 항목 수(한국 열). */
  official?: number;
}
interface Chunk { events: PublishedEvent[] }
/** 국사편찬위원회 연표 한 항목 — 원문 그대로. */
interface OfficialEntry { id: string; db: string; series: string | null; date_ko: string; text: string; url: string | null }
interface Detail {
  id: string;
  title: string;
  /** 위키백과 연표 원문 줄. editorial-policy §1-6 — 우리가 쓴 문장은 없다. 국사편찬위가 1차 출처면 official[]에만 있다. */
  text?: string;
  /** 기계 번역과 그 출처(모델·시각). 원문이 진본. */
  text_ko?: string;
  mt?: { model: string; at: string };
  /** 지은 제목과 그 출처. 제목이 파생물이라는 사실을 상세가 들고 있어야 표시할 수 있다. */
  name_ko?: string;
  name_mt?: { model: string; at: string };
  /** 연결 문서의 한국어 위키백과 첫 문단(tools/summaries.mjs). 인물·왕조 문서면 그 설명. */
  about?: { title: string; text: string; url: string; revid: number | null; license: string };
  lang: string;
  year: number;
  license: string;
  official: (OfficialEntry & { license: string })[];
  /** 같은 사건의 다른 언어판 연표 원문(병합됨). */
  alt: { lang: string; text: string; url: string }[];
  src: { url: string; revid: number; accessedAt: string; license: string }[];
}
/** official/kr/{연도}.json — 이 해의 공식 연표. */
interface OfficialYear { year: number; count: number; shown: number; license: string; entries: OfficialEntry[] }
interface Manifest { stage: "published" | "preview"; counts: { events: number; officialMatched?: number } }
/**
 * 기간 프레임의 원천(spans.json, tools/publish.mjs). **청크와 따로 받는다.**
 *
 * 프레임을 로드된 청크에서 파생하면 연도 레벨(10년 청크)에서 **시작 연도가 안 실린 구간에서
 * 사라진다.** 실측(2026-09-20): 133건 중 39건이 10년 경계를 넘고, 쿠빌라이-카이두 전쟁
 * (1268–1301)은 1272년에서 그려지는데 1295년에서는 0개였다.
 *
 * 티어는 싣지 않는다 — `tier`는 청크 도착 시 순위로 계산하는 값이라 **줌 레벨마다 달라진다.**
 * 프레임은 `baseTier(imp)`만 본다. 그래서 어느 줌에서 보든 같은 기간이 같은 프레임을 갖는다
 * (그 결과 순위로 강등되던 4건이 프레임을 되찾는다 — 전부 imp 4다).
 */
interface Span { r: RegionId; id: string; y0: number; y1: number; m?: number; imp: number }

/** 정치체 밴드(polities.json, tools/polities.mjs). y1 null = 진행 중. */
interface Polity {
  id: string;
  name: string;
  names: Partial<Record<"ko" | "en" | "ja" | "zh", string | null>>;
  y0: number;
  y1: number | null;
  hist: "historical" | "traditional";
  label: string;
  note?: string;
}
type Polities = Partial<Record<RegionId, Polity[]>>;

const DATA = "/data/v1";
// BAND_LABEL_H · COLUMN_HEADER_H는 lib/design/metrics.ts가 원본이다(globals.css가 사본, 테스트가 계약).

/** 착지(§5-7, C-1 권고안): 십년 레벨로 최근 수십 년. 1980을 중앙에 두면 766px 뷰포트에 1930년대~현재가 든다. */
const LANDING_YEAR = 1980;
const LANDING_S = 8;
/** 스크롤이 이만큼 멎으면 URL을 갱신한다(ms). */
const URL_IDLE_MS = 300;

/** `/?y=1882&s=40` → 중앙 연도·스케일. 없거나 망가졌으면 null. */
function readUrlState(): { y: number | null; s: number | null; r: RegionId[] | null; lang: Locale | null } {
  if (typeof location === "undefined") return { y: null, s: null, r: null, lang: null };
  const q = new URLSearchParams(location.search);
  const lang = q.get("lang");
  const y = Number(q.get("y"));
  const s = Number(q.get("s"));
  // ?r=kr,jp — 열 조합·순서(§5-8). 모르는 id는 버리고, 하나도 안 남으면 기본 4열
  const ids = (q.get("r") ?? "").split(",").filter((id): id is RegionId => COLUMNS.some((c) => c.id === id));
  const r = [...new Set(ids)];
  return {
    y: q.has("y") && Number.isFinite(y) && y >= AXIS_YEAR_START && y <= AXIS_YEAR_END ? Math.round(y) : null,
    s: q.has("s") && Number.isFinite(s) && s > 0 ? s : null,
    r: r.length ? r : null,
    lang: isLocale(lang) ? lang : null,
  };
}

/**
 * 나라 색은 이제 **세 곳에만** 나온다 — 열 헤더의 이름, 그 아래 3px 밑선, 상세의 관점별 명칭 라벨.
 * 격자 안은 무채색이다(README 규칙 1). 값은 globals.css의 --color-region-* 토큰이고
 * 여기서는 var() 문자열만 만든다 — 컴포넌트에 hex를 쓰지 않는다(AGENTS.md).
 */
const regionVar = (id: RegionId) => `var(--color-region-${id})`;
/** 국기(public/flags, 위키미디어 공용의 공유 저작물). 윈도우는 국기 이모지를 못 그려서 SVG로. */
const FLAG: Record<RegionId, string> = { kr: "/flags/kr.svg", cn: "/flags/cn.svg", jp: "/flags/jp.svg", us: "/flags/us.svg", ai: "/flags/ai.svg" };

/**
 * 왕조 러그 — 배경 밴드를 대신한다(README 7-4). 색이 아니라 명암 두 톤이므로 네 열이
 * 무지개가 되지 않고, 3px 폭이라 글자 대비를 깎지도 않는다. 이름은 열 헤더(sticky)에만 나온다.
 */
const lugVar = (i: number) => (i % 2 === 0 ? "var(--color-lug-a)" : "var(--color-lug-b)");

/*
 * 상세 패널의 출처 블록. 테두리 상자 대신 윗선 하나와 여백으로 나눈다 —
 * 상자가 넷이면 패널이 서랍장이 되고, 안쪽 글이 상자 벽에 붙어 읽기가 나빠진다.
 */
const BLOCK = "border-t border-line py-5 first:border-t-0";
const BLOCK_LABEL = "flex flex-wrap items-center gap-1.5 text-block-label font-semibold uppercase tracking-[.1em] text-fg-subtle";
const BLOCK_BODY = "mt-1.5 text-body [text-wrap:pretty] [word-break:keep-all]";
const BLOCK_META = "mt-1.5 text-item-meta text-fg-subtle";
/** 원문이 어느 언어판인지 — 라벨 옆 작은 상자. 격자의 「원문 EN」과 같은 정보다. */
const LANG_TAG = "rounded border border-line px-1 text-block-label tracking-normal text-fg-subtle";

/** 그 해 그 열의 정치체. 밴드는 약 40개라 선형 탐색으로 충분하다. */
const polityAt = (list: Polity[] | undefined, year: number): Polity | undefined =>
  list?.find((p) => p.y0 <= year && (p.y1 == null || year < p.y1));

export function TimelineGrid() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  /** 모바일 시대 스크러버(§5-7) — 레일이 숨는 768px 미만에서 오른쪽 16px. */
  const scrubRef = useRef<HTMLDivElement>(null);
  const [scrubH, setScrubH] = useState(600);

  // s의 초기값은 십년 레벨. 착지 지점은 §11 C-1이 정해지면 바꾼다.
  const [axis, setAxis] = useState<Axis>({ s: 8, viewportH: 800 });
  const [scrollTop, setScrollTop] = useState(0);
  /**
   * 좁은 화면(<600px). 축 폭·항목 높이·메타 줄 유무가 여기서 갈린다(README §화면 → 모바일).
   * 열 축소(<360 1열 · <600 2열)는 착지 때 한 번뿐이지만, 이 값은 회전·리사이즈를 따라간다.
   */
  const [narrow, setNarrow] = useState(false);
  /**
   * 로빙 tabindex의 활성 항목. 칩이 전부 tabIndex=0이면 상단바에서 하단까지 탭이 100번 넘게
   * 걸린다 — 격자 안에서는 **하나만** 탭 정류장이고 나머지는 화살표로 옮겨 다닌다(ARIA grid).
   */
  const [active, setActive] = useState<{ col: RegionId; b: number; i: number } | null>(null);
  /**
   * 상세 패널이 밀어내기(push)인가. 폭 사다리에서 >1440만 비모달이고, 그 아래(오버레이·바텀 시트)는
   * 격자를 덮으므로 **모달**이어야 한다 — role·포커스 트랩·inert가 여기서 갈린다.
   */
  const [spans, setSpans] = useState<Span[]>([]);
  const [pushMode, setPushMode] = useState(false);
  /**
   * 포인터가 굵은가(터치). 항목 높이의 하한을 24px로 올리는 데만 쓴다 — 폭이 아니라
   * 포인터로 갈라야 좁은 데스크톱 창에서 밀도를 헛되게 깎지 않는다(metrics.itemHeights).
   * 서버 렌더에서는 false로 시작한다: 하이드레이션 불일치를 만들지 않으려면 첫 렌더가
   * 양쪽에서 같아야 하고, 실제 값은 아래 효과가 채운다.
   */
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const mq = matchMedia("(min-width: 90rem)"); // --breakpoint-wide
    const sync = () => setPushMode(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** 의미 레벨은 스케일에서 바로 나오지 않는다 — 경계 왕복을 막는 이력이 있다(§5-3). */
  const [level, setLevel] = useState<Level>(() => levelOf(8));
  const [railH, setRailH] = useState(800);

  /** 줌으로 계산한 scrollTop. 스페이서 height가 쓰인 뒤 같은 패스에서 대입한다. */
  const pendingTop = useRef<number | null>(null);
  /** 연속 제스처가 붙잡고 있는 앵커. 픽셀이 아니라 연도다(§5-5A). */
  const gesture = useRef<{ year: number; offsetY: number; until: number } | null>(null);
  const rafRef = useRef(0);
  /** 이벤트 리스너가 최신 axis를 보게 한다 — 리스너를 재등록하지 않기 위해. */
  const axisRef = useRef(axis);
  axisRef.current = axis;

  // ── 데이터: 청크 캐시 ─────────────────────────────────────────────────────
  // 보이는 행에서 청크 키가 나오고(§5-5A), 키마다 한 번만 받는다. 캐시는 ref에 두고
  // 도착할 때만 카운터로 다시 그린다 — 스크롤마다 state를 만지지 않기 위해서다.
  const chunks = useRef(new Map<string, PublishedEvent[] | null>());
  const inflight = useRef(new Set<string>());
  const [, bump] = useState(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  /**
   * 상세는 **세 상태**다 — `null`(받는 중) · `Detail`(받음) · `"error"`(못 받음).
   *
   * 처음에는 둘뿐이었고 실패가 `.catch(() => {})`로 삼켜져 `null`에 머물렀다. 그러면
   * 「불러오는 중…」이 **영원히** 남고 출처·오류신고 줄도 안 나와서, 사용자는 "느린가 보다"로
   * 읽는다. 곧 들어올 `?e=` 딥링크가 닿는 곳이 바로 이 패널이라 더더욱 구별해야 한다.
   */
  const [selected, setSelected] = useState<{ ev: PublishedEvent; detail: Detail | null | "error" } | null>(null);
  /** 검색 오버레이. 색인은 열 때 받는다(src/lib/search.ts) — 첫 화면 예산에 얹지 않는다. */
  const [searchOpen, setSearchOpen] = useState(false);
  /** 패널이 격자를 덮는가 — 덮으면 모달이고, 격자는 inert가 된다. */
  const modalPanel = selected !== null && !pushMode;
  /** 상세 제목 — 모달로 열릴 때 포커스가 여기로 간다. */
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /**
   * 패널을 닫은 뒤 포커스를 마지막 항목으로 되돌릴지. **즉시 focus()를 부르면 안 된다** —
   * 모달일 때 격자에 inert가 걸려 있고, 그 해제는 다음 렌더에 일어난다. inert 안쪽으로의
   * focus()는 조용히 무시된다(실측 2026-09-12). 그래서 렌더 뒤에 되돌린다.
   */
  const restorePending = useRef(false);

  /** 상세 패널 "이 해의 공식 연표" — 눌렀을 때만 받는다(한 해 최대 80건). */
  const [officialYear, setOfficialYear] = useState<OfficialYear | null>(null);
  /** <1024px 바텀 시트의 반 높이(50svh) ↔ 전체(100dvh) 토글(PRD §5-7 §4-3). */
  const [sheetFull, setSheetFull] = useState(false);
  /** 첫 방문 1회 힌트(§5-7 착지). 본 적 있으면 안 띄운다 — 브라우저에만 남기는 값이다. */

  const [polities, setPolities] = useState<Polities>({});
  /** UI 언어(대표 지시 2026-09-05). 한국어 기본, URL ?lang=로 왕복. 사건 라벨·열 이름·연도 표기·문구가 바뀐다. */
  const [locale, setLocale] = useState<Locale>("ko");
  const t = T[locale];
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  /** 정치체 라벨 — ko는 발행 라벨 그대로, 다른 언어는 그 언어판 이름 + 연도. */
  const shortYear = (y: number) => formatYearL(y, locale).replace(/[년年]$/, "");
  const polityLabel = (p: Polity) => (locale === "ko" ? p.label : `${p.names[locale] ?? p.name} ${shortYear(p.y0)}–${p.y1 == null ? "" : shortYear(p.y1)}`);
  const polityName = (p: Polity) => (locale === "ko" ? p.name : p.names[locale] ?? p.name);
  const regionLabel = (id: RegionId) => REGION_LABEL[locale][id];
  const yearLabel = (ev: PublishedEvent) => (locale === "ko" ? ev.date_ko : `${ev.approx ? "c. " : ""}${formatYearL(ev.y0, locale)}`);
  /** 드래그로 열 순서 바꾸기(HTML5 DnD). ◂ ▸ 버튼은 키보드·모바일용으로 남긴다. */
  const dragCol = useRef<RegionId | null>(null);
  const moveColTo = (from: RegionId, to: RegionId) =>
    setCols((cs) => {
      const i = cs.indexOf(from), j = cs.indexOf(to);
      if (i < 0 || j < 0 || i === j) return cs;
      const next = cs.filter((x) => x !== from);
      next.splice(j, 0, from);
      return next;
    });
  /** 보이는 열과 순서(PRD §4-1 열 추가·삭제·순서). URL ?r=로 왕복. 첫 열이 홈 열(시대 레일). */
  const [cols, setCols] = useState<RegionId[]>(() => [...DEFAULT_COLS]);
  const shown = cols.map((id) => COLUMNS.find((c) => c.id === id)!);
  const hiddenCols = COLUMNS.filter((c) => !cols.includes(c.id));
  const removeCol = (id: RegionId) => setCols((cs) => (cs.length > 1 ? cs.filter((x) => x !== id) : cs));
  const addCol = (id: RegionId) => setCols((cs) => (cs.includes(id) ? cs : [...cs, id]));
  const moveCol = (id: RegionId, dir: -1 | 1) =>
    setCols((cs) => {
      const i = cs.indexOf(id), j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  /**
   * 발행 버전(manifest.publishedAt). 청크·상세 경로는 발행마다 같아서 브라우저가 이전 발행분을
   * 캐시한다(2026-09-05: C-2로 뺀 2026년 칩이 계속 보였다). manifest만 재검증해 받고, 나머지 요청에
   * ?v=버전을 붙여 발행이 바뀌면 URL도 바뀌게 한다.
   */
  const [dataVersion, setDataVersion] = useState<string | null>(null);
  const withV = useCallback((path: string) => `${path}?v=${encodeURIComponent(dataVersion ?? "")}`, [dataVersion]);

  useEffect(() => {
    /*
      한 번만 받는 것 셋: manifest(버전) · polities(왕조 밴드) · spans(기간 프레임).
      spans는 청크와 달리 **전부 한 파일**이다 — 기간은 어느 지점에서 보든 같아야 하는데,
      청크에서 파생하면 시작 연도가 안 실린 구간에서 사라졌다(Span 타입 주석).
    */
    fetch(`${DATA}/manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<Manifest & { publishedAt?: string }>) : null))
      .then(async (m) => {
        setManifest(m);
        const v = encodeURIComponent(m?.publishedAt ?? String(Date.now()));
        setDataVersion(m?.publishedAt ?? String(Date.now()));
        const [pol, spn] = await Promise.all([
          fetch(`${DATA}/polities.json?v=${v}`).then((r) => (r.ok ? (r.json() as Promise<{ regions: Polities }>) : null)),
          fetch(`${DATA}/spans.json?v=${v}`).then((r) => (r.ok ? (r.json() as Promise<{ spans: Span[] }>) : null)),
        ]);
        setPolities(pol?.regions ?? {});
        setSpans(spn?.spans ?? []);
      })
      .catch(() => { setManifest(null); setPolities({}); setSpans([]); });
  }, []);

  const ensureChunk = useCallback((region: RegionId, key: string) => {
    if (!dataVersion) return; // manifest가 오기 전엔 받지 않는다 — 버전 없는 URL은 이전 발행분 캐시를 부른다
    const path = `${DATA}/events/${region}/${key}.json`;
    if (chunks.current.has(path) || inflight.current.has(path)) return;
    inflight.current.add(path);
    fetch(withV(path))
      .then((r) => (r.ok ? (r.json() as Promise<Chunk>) : null))
      .then((c) => {
        const evs = c?.events ?? null;
        chunks.current.set(path, evs); // 404도 기록 — 빈 구간은 다시 묻지 않는다
      })
      .catch(() => chunks.current.set(path, null))
      .finally(() => {
        inflight.current.delete(path);
        bump((n) => n + 1);
      });
  }, [dataVersion, withV]);

  // ── 뷰포트 높이 추적 + 착지 ───────────────────────────────────────────────
  // 첫 측정에서 URL(?y=&s=)이 있으면 그 자리로, 없으면 최근 수십 년(§5-7 착지, C-1 권고안)으로.
  // 브라우저 스크롤 복원은 끈다 — 스페이서 높이가 s에 따라 달라 저장된 scrollTop이 다른 해를 가리킨다.
  const landed = useRef(false);
  /** 착지 목표. 스페이서가 새 s·viewportH로 그려진 뒤에야 scrollTop을 놓을 수 있어 축 값과 대조해 적용한다. */
  const landing = useRef<{ y: number; s: number; vh: number } | null>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const sync = () => {
      const vh = el.clientHeight;
      if (!landed.current && vh > 0) {
        landed.current = true;
        const url = readUrlState();
        const s = clampScale(url.s ?? LANDING_S, vh);
        // pendingTop을 여기서 쓰면 안 된다 — 이 효과와 같은 커밋에서 아래 적용 효과가 먼저 소비해 버려
        // 아직 s=8 높이인 스페이서에 s=40용 scrollTop을 넣고 끝난다(1882 요청이 45년에 착지했다)
        landing.current = { y: url.y ?? LANDING_YEAR, s, vh };
        // 열이 너무 좁아지면 개수를 줄인다(§5-7) — 규칙은 하나이고 **열 폭**으로 적는다.
        //
        // 폰(<600px)은 두 줄 헤더라 고정분이 작다. <360px 1열 · <600px 2열은 390px에서 손으로
        // 검증된 값이라(왕조 이름 129px) 그대로 둔다.
        //
        // 그 위는 한 줄 헤더라 고정분이 149px이고 전부 shrink-0이다. 열당 COL_W_MIN_WIDE(210px)를
        // 못 주면 왕조 이름이 0px이 되고 조작 버튼이 옆 열로 넘친다 — AI 열이 기본이 되어 5열이 된
        // 뒤 600~1024px이 그 상태였다(실측 2026-09-20, metrics.ts COL_W_MIN_WIDE 표).
        //
        // URL에 ?r=이 있으면 그것이 우선 — 사용자가 고른 조합을 화면 크기로 덮지 않는다
        if (url.r) setCols(url.r);
        else {
          const w = el.clientWidth;
          if (w > 0 && w < 600) setCols(DEFAULT_COLS.slice(0, w < 360 ? 1 : 2));
          else if (w > 0) setCols(DEFAULT_COLS.slice(0, colsForWidth(w)));
        }
        if (url.lang) setLocale(url.lang);
        setAxis({ s, viewportH: vh });
      } else {
        // 창이 줄면 s도 함께 눌러야 한 행이 뷰포트를 넘지 않는다(§5-5A S_MAX)
        setAxis((a) => (a.viewportH === vh ? a : { s: clampScale(a.s, vh), viewportH: vh }));
      }
      setNarrow(el.clientWidth > 0 && el.clientWidth < 600);
      if (railRef.current) setRailH(railRef.current.clientHeight);
      if (scrubRef.current) setScrubH(scrubRef.current.clientHeight);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, []);

  // ── URL 왕복 (§5-8 `/?y=&s=`): 중앙 연도는 scrollTop의 파생값, 멈추면 replaceState ─
  useEffect(() => {
    if (!landed.current || landing.current) return; // 착지 전의 scrollTop 0을 URL에 쓰지 않는다
    const t = setTimeout(() => {
      const y = Math.round(centerYear(scrollTop, axis));
      const url = `${location.pathname}?r=${cols.join(",")}&y=${y}&s=${Number(axis.s.toFixed(2))}${locale === "ko" ? "" : `&lang=${locale}`}`;
      if (location.search !== url.slice(location.pathname.length)) history.replaceState(null, "", url);
    }, URL_IDLE_MS);
    return () => clearTimeout(t);
  }, [scrollTop, axis, cols, locale]);

  // ── 줌 결과 반영: 스페이서 height가 쓰인 뒤 같은 레이아웃 패스에서 ────────
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 착지: 축이 목표 s·viewportH로 그려진 커밋에서만 놓는다
    const l = landing.current;
    if (l && axis.s === l.s && axis.viewportH === l.vh) {
      landing.current = null;
      el.scrollTop = scrollTopForYear(l.y, axis);
      setScrollTop(el.scrollTop);
      setLevel(levelOf(axis.s)); // 착지는 이력이 없다 — s=40 경계에 내려도 히스테리시스가 십년 레벨을 붙들지 않게
      el.focus({ preventScroll: true }); // 화살표·PageUp/Down이 바로 시간축을 움직이게
      return;
    }
    if (pendingTop.current === null) return;
    el.scrollTop = pendingTop.current;
    pendingTop.current = null;
    setScrollTop(el.scrollTop); // 읽어 오는 값은 기기 픽셀 격자에 스냅된 결과다(§11 C-11)
  });

  // ── 스크롤 추적 (rAF 코얼레싱, DOM 쓰기 없음) ────────────────────────────
  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollerRef.current;
      if (el) setScrollTop(el.scrollTop);
    });
  }, []);

  // ── 줌: Ctrl+휠 · 핀치. 일반 휠은 브라우저에 맡긴다 ──────────────────────
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // 시간 이동은 네이티브 스크롤
      e.preventDefault(); // 브라우저 페이지 줌 차단
      const rect = el.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const now = performance.now();
      const cur = axisRef.current;
      let g = gesture.current;
      if (!g || now > g.until || Math.abs(g.offsetY - offsetY) > 24) {
        g = { year: anchorYearAt(el.scrollTop, offsetY, cur), offsetY, until: 0 }; // 제스처 시작 — 앵커 연도를 한 번만
      }
      g.until = now + GESTURE_IDLE_MS;
      gesture.current = g;
      const sNext = clampScale(cur.s * Math.exp(-e.deltaY * 0.002), cur.viewportH);
      if (sNext === cur.s) return;
      pendingTop.current = zoomToYear(g.year, g.offsetY, sNext, cur.viewportH);
      setAxis((a) => ({ ...a, s: sNext }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    /**
     * 핀치 줌(§5-5 표, 부록 A-10). 두 손가락이 닿는 동안 컨테이너를 overflow:hidden으로 바꿔 네이티브
     * 팬을 끊고(그러면 iOS가 scrollTop을 건드리지 않는다), 두 손가락 중심의 연도를 고정한 채 s를 바꾼다.
     * 손가락을 떼면 원래대로 — 그때 scrollTop을 다시 써 준다(끊는 동안 브라우저가 0으로 되돌리는 경우 대비).
     */
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; s0: number; year: number; offsetY: number; top: number } | null = null;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const cur = axisRef.current;
        const rect = el.getBoundingClientRect();
        const [a, b] = [...pts.values()];
        const offsetY = (a!.y + b!.y) / 2 - rect.top;
        pinch = { dist: dist(), s0: cur.s, year: anchorYearAt(el.scrollTop, offsetY, cur), offsetY, top: el.scrollTop };
        el.style.overflowY = "hidden"; // 네이티브 팬 차단
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch || pts.size !== 2) return;
      e.preventDefault();
      const d = dist();
      if (!d || !pinch.dist) return;
      const sNext = clampScale(pinch.s0 * (d / pinch.dist), axisRef.current.viewportH);
      if (sNext === axisRef.current.s) return;
      pendingTop.current = zoomToYear(pinch.year, pinch.offsetY, sNext, axisRef.current.viewportH);
      setAxis((a) => ({ ...a, s: sNext }));
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pts.delete(e.pointerId);
      if (pinch && pts.size < 2) {
        const top = pendingTop.current ?? el.scrollTop;
        pinch = null;
        el.style.overflowY = "";
        pendingTop.current = top; // overflow를 되돌린 뒤 다시 놓는다(A-10: iOS scrollTop 보존 확인 항목)
        setAxis((a) => ({ ...a }));
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // ── 뷰포트 중앙 기준 줌 — 키보드(+/−/0)와 하단 줌 바가 같이 쓴다(§5-5 표) ──
  const zoomCenterTo = useCallback((sTarget: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cur = axisRef.current;
    const mid = cur.viewportH / 2;
    const sNext = clampScale(sTarget, cur.viewportH);
    if (sNext === cur.s) return;
    const year = anchorYearAt(el.scrollTop, mid, cur);
    pendingTop.current = zoomToYear(year, mid, sNext, cur.viewportH);
    setAxis((a) => ({ ...a, s: sNext }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "+" && e.key !== "=" && e.key !== "-" && e.key !== "0") return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
      const cur = axisRef.current;
      zoomCenterTo(e.key === "0" ? LANDING_S : cur.s * (e.key === "-" ? 1 / 1.6 : 1.6));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomCenterTo]);

  /**
   * Esc — 상세 닫고 마지막 항목으로 포커스 복귀.
   * **window에 건다.** onGridKey는 스크롤 컨테이너에 붙어 있고 <aside>는 그 형제라, 패널 안에
   * 포커스가 있으면 Esc가 닿지 않는다. 지금까지는 포커스가 우연히 칩에 남아 동작했지만,
   * 아래에서 모달일 때 포커스를 패널로 옮기므로 그대로 두면 Esc가 죽는다(같은 커밋이어야 하는 이유).
   */
  useEffect(() => {
    if (!selected) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setSelected(null);
      restorePending.current = true;
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [selected]);

  /**
   * 모달일 때만 포커스를 패널로 옮기고 Tab을 가둔다. push(>1440)는 격자와 나란히 있으므로
   * 맥락을 끊지 않도록 포커스를 그대로 둔다 — 같은 컴포넌트가 폭에 따라 다른 것이 되는 셈이다.
   * 라이브러리 없이 20줄이면 된다(axis.ts와 같은 "의존성 0" 규약).
   */
  useEffect(() => {
    if (!modalPanel) return;
    headingRef.current?.focus({ preventScroll: true });
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const f = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      const cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === headingRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [modalPanel]);

  useEffect(() => {
    if (selected || !restorePending.current) return;
    restorePending.current = false;
    lastChip.current?.focus({ preventScroll: true });
  }, [selected]);

  // ── 의미 레벨: s에서 파생하되 이력을 둔다(§5-3) ──────────────────────────
  useEffect(() => {
    setLevel((prev) => levelWithHysteresis(axis.s, prev));
  }, [axis.s]);

  // ── 파생값 ───────────────────────────────────────────────────────────────
  const rows = visibleRows(scrollTop, axis, level);
  const from = rows.from - rows.unit * OVERSCAN_ROWS;
  const to = rows.to + rows.unit * OVERSCAN_ROWS;
  const buckets: number[] = [];
  for (let b = from; b <= to; b += rows.unit) buckets.push(b);

  const win = railWindow(scrollTop, axis, railH);
  const bounds = scaleBounds(axis.viewportH);
  const chunkKeys = Array.from(new Set(buckets.map((b) => chunkKeyFor(b, rows.level))));

  // 보이는 청크를 받아 둔다(프리페치는 오버스캔 행 몫). 렌더 중 fetch 시작은 effect에서.
  useEffect(() => {
    for (const id of cols) for (const key of chunkKeys) ensureChunk(id, key);
  }, [chunkKeys.join("|"), cols.join(","), ensureChunk]); // eslint-disable-line react-hooks/exhaustive-deps

  /** (열, 행 버킷) → 그 칸의 사건. 발행 시 정렬돼 있으므로 다시 정렬하지 않는다(§6-2). */
  const cellEvents = (region: RegionId, b: number): PublishedEvent[] => {
    const evs = chunks.current.get(`${DATA}/events/${region}/${chunkKeyFor(b, rows.level)}.json`);
    if (!evs) return [];
    return evs.filter((e) => bucketStart(e.y0, rows.unit) === b);
  };
  const loadedChunks = Array.from(chunks.current.values()).filter(Boolean).length;

  const openOfficialYear = (year: number) => {
    fetch(withV(`${DATA}/official/kr/${year}.json`))
      .then((r) => (r.ok ? (r.json() as Promise<OfficialYear>) : null))
      .then((o) => setOfficialYear(o))
      .catch(() => setOfficialYear(null));
  };
  /** 마지막으로 연 칩 — Esc로 상세를 닫을 때 포커스를 돌려준다. */
  const lastChip = useRef<HTMLButtonElement | null>(null);
  /**
   * 키보드(§5-5 표): ↑↓·PageUp/Down·Home/End는 네이티브 스크롤(컨테이너가 포커스를 받는다).
   * 칩에 포커스가 있을 때 ←→는 옆 열의 같은 행(없으면 가장 가까운 행), ↑↓는 같은 열의 이전·다음 칩.
   * Enter/Space는 버튼 기본 동작(상세). Esc는 상세 닫기 + 칩으로 포커스 복귀.
   */
  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const chip = (e.target as HTMLElement).closest?.("button[data-col]") as HTMLButtonElement | null;
    if (!chip || !scrollerRef.current) return;
    const col = chip.dataset.col as RegionId, b = Number(chip.dataset.b);
    const all = [...scrollerRef.current.querySelectorAll<HTMLButtonElement>("button[data-col]")];
    let next: HTMLButtonElement | undefined;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const target = cols[cols.indexOf(col) + (e.key === "ArrowRight" ? 1 : -1)];
      if (!target) return;
      const inCol = all.filter((x) => x.dataset.col === target);
      next = inCol.find((x) => Number(x.dataset.b) === b) ?? [...inCol].sort((p, q) => Math.abs(Number(p.dataset.b) - b) - Math.abs(Number(q.dataset.b) - b))[0];
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const inCol = all.filter((x) => x.dataset.col === col); // DOM 순서 = 위→아래
      next = inCol[inCol.indexOf(chip) + (e.key === "ArrowDown" ? 1 : -1)];
    } else return;
    if (!next) return;
    e.preventDefault();
    // 로빙 tabindex — 옮겨 간 곳이 새 탭 정류장이 된다
    setActive({ col: next.dataset.col as RegionId, b: Number(next.dataset.b), i: Number(next.dataset.i) });
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest" });
  };
  /** 추천 연도 칩·연도 랜딩: 그 해를 연도 레벨(s=40)로 중앙에. 줌과 같은 경로(pendingTop) — 이벤트 핸들러라 경쟁이 없다 */
  const goTo = (year: number, sTarget = 40) => {
    const s = clampScale(sTarget, axis.viewportH);
    pendingTop.current = scrollTopForYear(year, { s, viewportH: axis.viewportH });
    setAxis((a) => ({ ...a, s }));
    setLevel(levelOf(s));
    setSelected(null);
  };
  const openDetail = (ev: PublishedEvent) => {
    setOfficialYear(null);
    setSelected({ ev, detail: null });
    loadDetail(ev);
  };
  /** 404도 네트워크 실패도 「실패」다 — 둘 다 사용자에게는 "안 나온다"로 같다. */
  const loadDetail = (ev: PublishedEvent) => {
    fetch(withV(`${DATA}/events/detail/${ev.id}.json`))
      .then((r) => (r.ok ? (r.json() as Promise<Detail>) : Promise.reject(new Error(String(r.status)))))
      .then((detail) => setSelected((s) => (s && s.ev.id === ev.id ? { ev, detail } : s)))
      .catch(() => setSelected((s) => (s && s.ev.id === ev.id ? { ev, detail: "error" } : s)));
  };

  const jumpTo = (box: HTMLDivElement | null, clientY: number) => {
    const el = scrollerRef.current;
    if (!box || !el) return;
    const r = box.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientY - r.top) / r.height, 0), 1);
    el.scrollTop = scrollTopForYear(AXIS_YEAR_START + ratio * AXIS_SPAN_YEARS, axis);
    setScrollTop(el.scrollTop);
  };
  const axisLabelW = narrow ? AXIS_LABEL_W_COMPACT : AXIS_LABEL_W;
  const minimapW = narrow ? MINIMAP_W_COMPACT : MINIMAP_W;
  const itemH = itemHeights(narrow, coarse);
  const laneW = narrow ? MORE_LANE_W_COMPACT : MORE_LANE_W;
  /**
   * 좁은 화면의 헤더는 **두 줄**이라 더 높다. 한 줄에 다 넣으면 왕조 이름에 남는 폭이 0px이라
   * 「조선 1392–1897」이 통째로 사라진다(실측 2026-09-13). metrics.COLUMN_HEADER_H_COMPACT 주석.
   */
  const colHeaderH = narrow ? COLUMN_HEADER_H_COMPACT : COLUMN_HEADER_H;

  const jumpFromRail = (clientY: number) => jumpTo(railRef.current, clientY);
  const jumpFromScrub = (clientY: number) => jumpTo(scrubRef.current, clientY);

  /**
   * 시대 레일(미니맵·스크러버)이 쓰는 열. 첫 열을 그대로 쓰면 **정치체가 없는 열**(ai)을
   * 맨 앞에 놓는 순간 왕조 계단이 통째로 빈다. 정치체를 가진 첫 열로 떨어진다.
   */
  const railCol: RegionId = cols.find((c) => polities[c]?.length) ?? "kr";

  const activeVisible = active !== null && buckets.includes(active.b) && cols.includes(active.col);
  /** 렌더 중에 한 번만 세워진다(위 주석). 매 렌더마다 새로 만들어지므로 상태가 새지 않는다. */
  let tabStopClaimed = activeVisible;

  return (
    <div className="flex h-full flex-col text-item">
      {/* 상단바 — 44px 한 줄(README 7-1). 알약·사각 버튼을 걷어내고 텍스트 링크로 낮췄다.
          「자리 고정」 규약은 유지한다 — 언어를 바꿔도 각 조각의 폭이 변하지 않아야 한다 */}
      <header className="flex shrink-0 items-center gap-4 border-b border-line px-4" style={{ height: TOPBAR_H }}>
        <span className="shrink-0 font-semibold tracking-tight">AI &amp; Human History</span>
        {/*
          추천 연도(§11 C-1). 조작을 배우기 전에 제품의 답을 먼저 보여준다.
          AI 열이 맨 앞에 서면서 세 해가 **없음 → 태동 → 만남**을 가르치게 골랐다(실측 2026-09-20):
            1592 축이 2,500년이라는 것. AI 열은 바로 위 1580년 「골렘 창조」뿐이고 그게 정직한 답이다
            1945 다섯 열이 모두 촘촘하고 AI가 태동한다(게임 이론·「우리가 생각하는 대로」 / 한 11 · 일 32)
            2016 AI와 한국이 같은 해에 만난다 — 알파고·이세돌 옆에 박근혜 탄핵소추안 발의
          390px에서는 이 다섯 조각의 합이 496px이라 마지막 「출처」가 잘려 나갔다.
          좁은 화면에서는 추천 연도·배지·출처를 ☰ 메뉴로 접고 언어만 남긴다(README §화면 → 모바일).
        */}
        <nav className="hidden shrink-0 gap-4 text-meta sm:flex" aria-label={t.recommended}>
          {[1592, 1945, 2016].map((y) => (
            <button key={y} type="button" onClick={() => goTo(y)} className="text-fg-subtle tabular-nums hover:text-fg">
              {formatYearL(y, locale)}
            </button>
          ))}
        </nav>
        {manifest?.stage === "preview" ? (
          <span className="ml-auto hidden min-w-0 truncate rounded bg-warn-surface px-1.5 py-0.5 text-meta text-warn-text sm:inline">{t.badgePreview(manifest.counts.events)}</span>
        ) : (
          <span className="ml-auto hidden min-w-0 truncate text-meta text-fg-subtle sm:inline">{manifest ? t.badge(manifest.counts.events) : t.noData}</span>
        )}
        {/* 언어(대표 지시 2026-09-05): 한국어 기본, URL ?lang=. 현재 언어만 진하게 */}
        <nav className="ml-auto flex shrink-0 gap-3 text-meta sm:ml-0" aria-label={t.language}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              title={LOCALE_LABEL[l]}
              className={locale === l ? "font-semibold text-fg" : "text-fg-subtle hover:text-fg"}
            >
              {l === "ko" ? "한국어" : l === "en" ? "EN" : l === "ja" ? "日" : "中"}
            </button>
          ))}
        </nav>
        {/* 언어마다 길이가 다른 마지막 조각(출처/Sources/出典/来源)도 고정 폭 — 아니면 왼쪽 언어 묶음이 밀린다 */}
        <a href={localePath(locale, "/sources")} className="hidden w-14 shrink-0 truncate text-right text-meta text-fg-subtle underline sm:block">{t.sources}</a>
        {/* 검색(§5-10 도해의 🔍). 연도 이동도 같은 오버레이 안에 있다 — 44px 한 줄에 입력창 자리가 없다 */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t.search}
          title={t.search}
          style={{ minWidth: HIT_MIN, minHeight: HIT_MIN }}
          className="hidden shrink-0 items-center justify-center text-meta text-fg-subtle hover:text-fg sm:flex"
        >
          <span aria-hidden>⌕</span>
        </button>
        {/* 화면 밝기 — 오른쪽 끝. 글리프 하나라 언어가 바뀌어도 폭이 그대로다(「자리 고정」 규약) */}
        <ThemeToggle t={t} className="hidden sm:flex" />
        {/* 좁은 화면의 ☰ — 접어 둔 세 조각이 여기 들어간다. 타깃은 44px(HIT_COMFORT) */}
        <details className="relative shrink-0 sm:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-center text-fg-subtle" style={{ width: HIT_COMFORT, height: HIT_COMFORT }} aria-label={t.recommended}>☰</summary>
          <div className="absolute right-0 top-full z-40 flex w-max flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-meta shadow-[var(--shadow-float)]">
            <div className="flex gap-4">
              {[1592, 1945, 2016].map((y) => (
                <button key={y} type="button" onClick={(e) => { goTo(y); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }} className="tabular-nums text-fg-subtle">
                  {formatYearL(y, locale)}
                </button>
              ))}
            </div>
            <span className="whitespace-nowrap text-fg-subtle">{manifest ? t.badge(manifest.counts.events) : t.noData}</span>
            <a href={localePath(locale, "/sources")} className="text-fg-subtle underline">{t.sources}</a>
            <button
              type="button"
              onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); setSearchOpen(true); }}
              className="text-left text-fg-subtle underline"
              style={{ minHeight: HIT_MIN }}
            >
              {t.search}
            </button>
            {/* 좁은 화면에서도 밝기를 바꿀 수 있어야 한다 — 상단바에는 자리가 없어 여기 들어간다 */}
            <span className="flex items-center gap-2 text-fg-subtle">{t.theme}<ThemeToggle t={t} /></span>
          </div>
        </details>
      </header>

      {/*
        검색·연도 이동. 격자 **밖**에 둔다 — 상세 패널과 같은 이유로, 열릴 때 격자에 inert를 걸기
        때문이다(안에 두면 오버레이 자신도 비활성이 된다).

        고른 결과로는 **그 해로 이동**한다. 사건 패널까지 여는 것은 `?e=` 딥링크(계획 4번)가
        들어온 뒤다 — 지금은 연도 레벨에 내려놓으면 그 칩이 화면에 있다.
      */}
      {searchOpen && (
        <SearchOverlay
          t={t}
          locale={locale}
          indexUrl={withV(`${DATA}/search.json`)}
          dataEndYear={AXIS_YEAR_END}
          onClose={() => setSearchOpen(false)}
          onPickYear={(y) => { setSearchOpen(false); goTo(y); }}
          onPickEvent={(hit: SearchHit) => {
            setSearchOpen(false);
            // 그 열이 꺼져 있으면 켠다 — 찾아 놓고 안 보이면 찾은 것이 아니다
            setCols((c) => (c.includes(hit.region) ? c : [...c, hit.region]));
            goTo(hit.year);
          }}
        />
      )}

      {/* 중간 영역. 배경이 캔버스라 열 카드 사이 10px으로 드러난다(README 7-3) */}
      <div className="relative flex min-h-0 flex-1 bg-canvas">
        {/*
          랜드마크. role="grid"는 랜드마크가 아니므로(스크롤러가 region을 잃는다) 격자를 <main>으로 감싼다.
          상세 패널은 **이 밖에** 둔다 — 모달일 때 여기에 inert를 걸기 때문이다. 안에 두면 패널 자신도
          비활성이 된다.
        */}
        <main className="relative flex min-w-0 flex-1" aria-label={t.timelineAria} inert={modalPanel || searchOpen}>
        {/* 시대 미니맵 10px — 레일 64 + 거터 56 = 120px을 86px 한 축으로 합친 그 왼쪽 끝(README 7-2).
            라벨은 없앴다. 왕조 이름은 열 헤더(sticky)가 맡는다 */}
        <div
          ref={railRef}
          onPointerDown={(e) => jumpFromRail(e.clientY)}
          className="relative shrink-0 cursor-grab bg-surface-sunken select-none"
          style={{ width: minimapW }}
          title={t.minimapTitle}
        >
          {/* 홈 열(첫 열) 왕조를 무채색 두 톤 계단으로 — 연도 도메인으로 매핑한다(§5-5A: 스크롤 비율이 아니다) */}
          {(polities[railCol] ?? []).map((p, i) => {
            const y0 = Math.max(p.y0, AXIS_YEAR_START);
            const y1 = Math.min(p.y1 ?? AXIS_YEAR_END + 1, AXIS_YEAR_END + 1);
            if (y1 <= y0) return null;
            const top = railY(y0, railH);
            return <div key={p.id} className="absolute inset-x-0" style={{ top, height: railY(y1, railH) - top, background: lugVar(i) }} title={polityLabel(p)} />;
          })}
          {/* 뷰포트 창 — 위아래 실선 + 옅은 채움 */}
          <div className="absolute inset-x-0 border-y-[1.5px] border-fg bg-fg/[.08]" style={{ top: win.top, height: win.height }} />
        </div>

        {/* 격자 — 카드 프레임 층(스크롤 안 함) 위에 스크롤러가 얹힌다 */}
        <div className="relative min-w-0 flex-1">
          {/*
            열 카드 테두리는 **스크롤하지 않는 층**에 그린다(README 7-3). 스크롤 컨테이너가 시간축
            그 자체이고 스페이서가 2만 px을 넘으므로, 카드를 스크롤 콘텐츠 안에 두면 둥근 모서리가
            축의 양 끝에서만 보인다. 이 층은 뷰포트 높이에 고정이라 위아래 모서리가 늘 보인다.
          */}
          <div className="pointer-events-none absolute inset-0 z-0 flex" aria-hidden>
            <div className="shrink-0" style={{ width: axisLabelW }} />
            {shown.map((c) => (
              <div key={c.id} className="min-w-0 flex-1 rounded-card border border-line bg-surface" style={{ marginLeft: CARD_GAP }} />
            ))}
          </div>

        {/* 스크롤 컨테이너 = 시간축 그 자체 (§5-5A) */}
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onKeyDown={onGridKey}
          tabIndex={0}
          /*
            격자 구조를 스크린리더에 알린다. 가상화 때문에 aria-rowcount가 필수다 — 없으면
            "3개 중 1번째 행"이라고 거짓말한다. 헤더가 1행이라 본문 행은 +2 오프셋.
            컨테이너가 tabIndex=0인 것은 유지한다: ↑↓·PageUp/Down·Home/End가 네이티브 스크롤
            (=시간 이동)이어야 하고 그러려면 컨테이너가 포커스를 받아야 한다(§5-5).
            그래서 탭 정류장은 컨테이너 + 활성 항목 둘이다(이전에는 100개가 넘었다).
          */
          role="grid"
          aria-readonly
          aria-rowcount={Math.ceil(AXIS_SPAN_YEARS / rows.unit) + 1}
          aria-colcount={shown.length + 1}
          aria-label={t.timelineAria}
          className="relative z-10 h-full overflow-y-auto bg-transparent outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overflowAnchor: "none", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
        >
          {/* 열 헤더 = 카드의 머리(README 7-3). 나라색 바탕을 없애고 흰 면 + 이름의 색 + 3px 밑선으로.
              polityAt(뷰포트 상단 연도)를 보므로 스크롤하면 왕조 이름이 저절로 바뀐다 —
              별도의 스티키 라벨 층이 필요 없어지는 이유다 */}
          <div className="sticky top-0 z-20 flex" style={{ height: colHeaderH }} role="row" aria-rowindex={1}>
            <div className="shrink-0" style={{ width: axisLabelW }} role="columnheader" aria-colindex={1} />
            {shown.map((c, i) => {
              const p = polityAt(polities[c.id], yToYear(scrollTop + colHeaderH, axis));
              /*
                WCAG 2.2 SC 2.5.8(AA)은 24×24다. 전에는 18.4×13에 이웃과 중심 간격 19px이라
                크기도, 크기 예외인 "간격"도 함께 미달이었다(실측). 24px 정사각으로 만들면
                gap 0에서 중심이 정확히 24px 떨어지므로 두 조건이 한 번에 풀린다 — 그래서
                gap-0.5를 버린다. 글리프는 13px 그대로이고 눌리는 면만 커진다.
              */
              const btn = "flex items-center justify-center rounded leading-none text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:invisible";
              const hit = { width: HIT_MIN, height: HIT_MIN } as const;
              const label = regionLabel(c.id);
              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => { dragCol.current = c.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                  onDragOver={(e) => { if (dragCol.current && dragCol.current !== c.id) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                  onDrop={(e) => { e.preventDefault(); if (dragCol.current) moveColTo(dragCol.current, c.id); dragCol.current = null; }}
                  onDragEnd={() => { dragCol.current = null; }}
                  className={`group relative flex min-w-0 flex-1 cursor-grab rounded-t-card border-b border-line bg-surface px-3 active:cursor-grabbing ${narrow ? "flex-col justify-center gap-0.5" : "items-center gap-2"}`}
                  style={{ marginLeft: CARD_GAP }}
                  role="columnheader"
                  aria-colindex={i + 2}
                >
                  {/*
                    좁은 화면은 **두 줄**이다. 한 줄이면 국기 20 + 이름 26 + 조작 72 + 여백 24가
                    먼저 차서 왕조 이름에 0px이 남는다(390px·2열 = 열 하나 153px, 실측 2026-09-13).
                    두 줄로 나누면 2줄이 열 전폭 129px을 받아 「에도 시대 1603–1868」까지 들어간다.
                    README §7-3(`◂ ▸ ×`는 그대로)과 §7-4(왕조 이름은 헤더에)가 둘 다 지켜진다.
                  */}
                  <div className={narrow ? "flex w-full items-center gap-2" : "contents"}>
                    <img src={FLAG[c.id]} alt="" width={20} height={14} className="h-[14px] w-5 shrink-0 rounded-[2px] object-cover opacity-90" draggable={false} />
                    <span className="shrink-0 text-col font-bold tracking-tight" style={{ color: regionVar(c.id) }}>{label}</span>
                    {/* 시대는 색이 아니라 서체로(README 규칙 2). 넓은 화면은 이 자리, 좁은 화면은 아랫줄 */}
                    {p && !narrow && <span className="min-w-0 truncate font-serif text-meta text-fg-muted">{polityLabel(p)}</span>}
                    {/* 열 조작(§4-1): 순서 ◂ ▸, 빼기 ×. 마지막 한 열은 뺄 수 없다 */}
                    <span className="ml-auto flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
                      <button type="button" style={hit} className={btn} disabled={i === 0} onClick={() => moveCol(c.id, -1)} aria-label={t.colLeft(label)}>◂</button>
                      <button type="button" style={hit} className={btn} disabled={i === shown.length - 1} onClick={() => moveCol(c.id, 1)} aria-label={t.colRight(label)}>▸</button>
                      <button type="button" style={hit} className={btn} disabled={shown.length === 1} onClick={() => removeCol(c.id)} aria-label={t.colRemove(label)}>×</button>
                    </span>
                  </div>
                  {p && narrow && <span className="w-full truncate font-serif text-meta text-fg-muted">{polityLabel(p)}</span>}
                  {/* 나라색이 남는 두 곳 중 하나 — 이름과 이 3px 밑선 */}
                  <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: regionVar(c.id) }} aria-hidden />
                </div>
              );
            })}
            {/* 열 넣기 — 행과 폭을 맞추기 위해 헤더 오른쪽 끝에 얹는다(셀을 추가하면 열 폭이 어긋난다) */}
            {hiddenCols.length > 0 && (
              <details className="absolute right-1 top-1 z-20 text-meta">
                <summary className="cursor-pointer list-none rounded border border-line-strong bg-surface px-1.5 leading-[18px] text-fg-muted hover:bg-surface-hover">{t.addColumn}</summary>
                <div className="absolute right-0 mt-1 flex flex-col rounded border border-line bg-surface py-1 shadow-[var(--shadow-float)]">
                  {hiddenCols.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="px-3 py-1 text-left hover:bg-surface-hover"
                      style={{ color: regionVar(c.id) }}
                      onClick={(e) => { addCol(c.id); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }}
                    >
                      {regionLabel(c.id)}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* 스페이서 */}
          <div className="relative w-full" style={{ height: contentHeight(axis) }} role="rowgroup">
            {/* 왕조 — 배경 밴드를 지우고 러그(3px)와 틱(20px)으로(README 7-4).
                배경 농도 교대는 글자 대비를 깎으면서 그 대가로 아무 이름도 알려주지 않았다.
                이름은 열 헤더가 맡고, 여기서는 "언제 바뀌었나"만 말한다.
                약 40개라 가상화하지 않는다(§5-5A 레이어) */}
            {/* 이 층은 pointer-events-none이라 title 툴팁이 뜰 수 없다 — 범위는 칩 라벨의
                "1592–1598"이 말한다. 그래서 spans.json에 제목을 싣지 않는다(9KB로 끝난다). */}
            <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
              <div className="shrink-0" style={{ width: axisLabelW }} />
              {shown.map((c) => (
                <div key={c.id} className="relative min-w-0 flex-1" style={{ marginLeft: CARD_GAP }}>
                  {(polities[c.id] ?? []).map((p, i) => {
                    const y0 = Math.max(p.y0, AXIS_YEAR_START);
                    const y1 = Math.min(p.y1 ?? AXIS_YEAR_END + 1, AXIS_YEAR_END + 1);
                    if (y1 <= y0) return null;
                    const top = yearToY(y0, axis);
                    return (
                      <span key={p.id}>
                        <span className="absolute left-0" style={{ top, height: (y1 - y0) * axis.s, width: LUG_W, background: lugVar(i) }} />
                        {/* 전체 폭 실선은 쓰지 않는다 — 시안 첫 판에서 얄타 회담의 메타 줄을 가로질렀다 */}
                        <span className="absolute border-t border-era-tick" style={{ top, left: LUG_W, width: ERA_TICK_W }} />
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* 기간 프레임 층(②a) — 지속을 **세로 범위**로 그린다(2026-09-09).
                이전에는 열 왼쪽 여백의 3px 실선이었는데, 그러면 지속이 시간축 위의 길이가 아니라
                한낱 표시가 된다. 이제 사건을 그 연도 수만큼 실제로 감싼다 — 시점 사건은 구조적으로
                흉내낼 수 없으므로 혼동이 없다. 채움 없이 테두리만 쓴다("빈 셀은 비어 있다"를 지키려면
                프레임이 열 배경을 바꾸면 안 된다).
                행 셀은 overflow hidden이라 행을 넘는 기간은 여기서 그린다. 프레임의 머리는 같은 사건의
                칩 그 자체다 — 칩이 이름을 대고 프레임이 범위를 댄다. 그래서 별도 라벨도, 셀에서 빼는
                처리도, 클릭 통과 문제도 생기지 않는다.
                60px보다 짧으면 프레임을 포기하고 칩 라벨의 "1592–1598"로 넘긴다(rank.SPAN_MIN_PX) */}
            <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
              <div className="shrink-0" style={{ width: axisLabelW }} />
              {shown.map((c) => {
                const cand = spans
                  .filter((sp) => sp.r === c.id)
                  // 티어 3은 프레임을 갖지 못한다. 프레임은 "이 안의 일들이 그 기간에 일어났다"는 강한 주장인데,
                  // 셀을 이끌 만하지 않은 항목이 그 주장을 하면 사실관계를 왜곡한다. 실제로 오파싱된
                  // "프룬제 아카데미아 …(1980–1994, 실제 1992년)"이 5·18 광주 민주화 운동을 감싸고 있었다
                  .filter((sp) => sp.y1 > sp.y0 && baseTier(sp.imp) <= 2)
                  .map((sp) => {
                    const top = yearToY(sp.y0 + ((sp.m ?? 1) - 1) / 12, axis) + CELL_PAD;
                    return { ev: sp, top, bottom: yearToY(sp.y1 + 1, axis) };
                  })
                  .filter((s) => s.bottom - s.top >= SPAN_MIN_PX)
                  .sort((a, b) => a.top - b.top);
                const lanes = assignLanes(cand);
                return (
                  <div key={c.id} className="relative min-w-0 flex-1" style={{ marginLeft: CARD_GAP }}>
                    {cand.map((s, i) => {
                      const lane = lanes[i]!;
                      if (lane < 0) return null; // 레인 초과 — 텍스트 표기로 떨어진다
                      return (
                        <div
                          key={s.ev.id}
                          className="absolute rounded-item border"
                          style={{ top: s.top, height: s.bottom - s.top, left: 2 + lane * 4, right: 2, borderColor: "var(--color-span-frame)" }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/*
              로빙 tabindex의 정류장을 정한다. 활성 셀이 화면(=가상화된 행 범위) 안에 있으면 그것이,
              없으면 **처음 그려지는 항목**이 정류장을 가져간다 — 활성 칩이 스크롤로 언마운트돼도
              탭으로 격자에 들어올 자리가 항상 하나는 남는다. buckets·shown 순서가 고정이라
              렌더 중 이 플래그를 세우는 것은 결정적이다.
            */}
            {buckets.map((b) => {
              const top = yearToY(b, axis);
              const h = rows.unit * axis.s;
              const sub = subdivisions(rows.level, h);
              return (
                <div
                  key={b}
                  className="absolute inset-x-0 flex border-t border-line-hairline"
                  style={{ top, height: h }}
                  role="row"
                  aria-rowindex={Math.floor((b - AXIS_YEAR_START) / rows.unit) + 2}
                >
                  {/* 연도 라벨 76px — 오른쪽 정렬 + 명조체(README 7-2). 시대·연도는 서체로 사건과 갈린다.
                      라벨이 행 높이를 넘으면 잘라 다음 행과 겹치지 않게(2026-09-05) */}
                  <div
                    className="relative shrink-0 overflow-hidden pr-2 text-right font-serif text-axis text-fg-muted tabular-nums"
                    style={{ width: axisLabelW }}
                    role="rowheader"
                    aria-colindex={1}
                  >
                    <span className="whitespace-nowrap">{formatRowLabelL(b, rows.level, locale)}</span>
                    {sub > 0 &&
                      Array.from({ length: sub - 1 }, (_, i) => (
                        <span key={i} className="absolute right-2 text-item-meta text-fg-subtle" style={{ top: ((i + 1) / sub) * h - 6 }}>
                          {rows.level === "decade" ? b + i + 1 : locale === "ko" ? `${i + 2}월` : locale === "en" ? ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i] : `${i + 2}月`}
                        </span>
                      ))}
                  </div>
                  {shown.map((c, ci) => {
                    const evs = cellEvents(c.id, b);
                    const { placed, hidden } = layoutCell(evs, h, b, rows.unit, locale, itemH, laneW);
    // 같은 셀에 같은 라벨이 둘 이상이면(도요토미 히데요시 ×3) 그 이름은 쓰지 않고 원문으로 되돌린다.
                    // 규칙은 i18n.ts의 dupNames 한 벌 — 여기서 nameIn만 세던 시절에는 지은 제목이 집합에
                    // 안 들어가 「3·1 운동」이 세 번 찍히는 것을 그리드만 못 막았다(연도 페이지는 막았다).
                    const dup = dupNames(placed.map((pl) => pl.ev), locale);
                    return (
                      // 세로 구분선은 없다 — 카드 사이 10px 여백이 그 일을 한다
                      <div key={c.id} className="relative min-w-0 flex-1 overflow-hidden" style={{ marginLeft: CARD_GAP }} role="gridcell" aria-colindex={ci + 2}>
                        {sub > 0 &&
                          Array.from({ length: sub - 1 }, (_, i) => (
                            <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-line-hairline" style={{ top: ((i + 1) / sub) * h }} aria-hidden />
                          ))}
                        {placed.map(({ ev, kind, top: itemTop, h: ih, laneEnd }, idx) => {
                          /*
                            위계가 2단이다(README 규칙 3). 등급의 축이 중요도가 아니라 **UI 언어로 읽히는가**다 —
                            실측에서 화면의 31%가 한국어 UI인데 영·중 원문이었고, 그 15건이 지저분함의 가장 큰
                            단일 원인이었다. 중요도 티어(rank.ts)는 셀 안 선별 순서와 기간 프레임 자격에 남지만
                            글자 크기에는 더 이상 쓰지 않는다.
                            번역이 채워지면 plain이 저절로 lead로 올라간다 — 디자인이 데이터 품질의 계기판이 된다.
                          */
                          // 로빙 tabindex: 활성 셀이면 그것, 활성이 화면 밖이면 처음 그려지는 항목이 정류장
                          const isTabStop = activeVisible
                            ? active!.col === c.id && active!.b === b && active!.i === idx
                            : !tabStopClaimed && (tabStopClaimed = true);
                          const label = eventLabel(ev, locale, dup);
                          const tag = originalTag(ev, locale);
                          const meta = [
                            ev.y1 !== undefined && ev.y1 > ev.y0 ? `${ev.y0}–${ev.y1}` : "",
                            ev.official ? t.nikhShort : "",
                            tag ? t.originalIn(ev.lang) : "",
                          ].filter(Boolean).join(" · ");
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              // 같은 항목을 다시 누르면 닫는다(토글, 대표 지시 2026-09-05). 다른 항목이면 바꿔 연다
                              onClick={(e) => { lastChip.current = e.currentTarget; setActive({ col: c.id, b, i: idx }); if (selected?.ev.id === ev.id) setSelected(null); else openDetail(ev); }}
                              onFocus={() => setActive({ col: c.id, b, i: idx })}
                              tabIndex={isTabStop ? 0 : -1}
                              aria-pressed={selected?.ev.id === ev.id}
                              title={ev.desc && locale === "ko" ? `${yearLabel(ev)} · ${ev.desc}` : yearLabel(ev)}
                              data-col={c.id}
                              data-b={b}
                              data-i={idx}
                              style={{ top: itemTop, height: ih, left: ITEM_INSET_START, right: ITEM_INSET_END, paddingRight: laneEnd }}
                              className={`absolute flex flex-col justify-center gap-px rounded-item px-1 text-left hover:bg-surface-hover/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus${selected?.ev.id === ev.id ? " bg-surface-hover ring-2 ring-selected-ring" : ""}`}
                            >
                              <span
                                className={`min-w-0 truncate ${kind === "lead" ? "text-item-lead font-semibold text-fg" : "text-item text-fg-muted"}${ev.hist === "traditional" ? " italic" : ""}`}
                              >
                                {label.name ?? label.text}
                              </span>
                              {meta && !narrow && <span className="min-w-0 truncate text-item-meta text-fg-subtle tabular-nums">{meta}</span>}
                            </button>
                          );
                        })}
                        {/* `+26` → `26건 더`. 줄바꿈 금지 · 불투명 — 잘린 글줄 위에 겹쳐 찍히면 읽을 수 없다 */}
                        {hidden > 0 && (
                          <span className="pointer-events-none absolute bottom-[3px] whitespace-nowrap bg-surface px-[3px] text-item-meta text-fg-subtle tabular-nums" style={{ right: ITEM_INSET_END }}>
                            {narrow ? hidden : t.moreCount(hidden)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          </div>

          {/* 떠 있는 줌 컨트롤(README 7-7) — 하단 40px 줌 바를 없애고 격자 위에 얹었다.
              레이아웃 높이를 먹지 않으므로 격자에 세로 52px이 돌아온다.
              조작 힌트도 여기 상시 있다 — 첫 방문 1회 알약과 상단바 안내문을 대신한다 */}
          <div className="absolute z-20 flex items-center gap-2 rounded-lg border border-line-strong bg-surface/95 px-2 py-1.5 shadow-[var(--shadow-float)] backdrop-blur" style={{ right: ZOOM_FLOAT_INSET, bottom: ZOOM_FLOAT_INSET }}>
            <span className="font-serif text-meta text-fg-strong tabular-nums">{formatYearL(Math.round(centerYear(scrollTop, axis)), locale)}</span>
            <span className="h-4 w-px bg-line" aria-hidden />
            <div className="flex items-center gap-0.5" role="group" aria-label={t.zoomGroup}>
              {LEVEL_STOPS.map((st) => (
                <button
                  key={st.level}
                  type="button"
                  onClick={() => zoomCenterTo(st.s)}
                  aria-pressed={rows.level === st.level}
                  className={`rounded px-2 py-0.5 text-meta ${rows.level === st.level ? "bg-surface-inverse text-fg-inverse" : "text-fg-muted hover:bg-surface-hover"}`}
                >
                  {t.level[st.level as Exclude<Level, "month">]}
                </button>
              ))}
            </div>
            <span className="h-4 w-px bg-line" aria-hidden />
            <span className="text-item-meta text-fg-subtle">{t.zoomHint}</span>
            {process.env.NODE_ENV === "development" && (
              <details className="font-mono text-item-meta text-fg-subtle">
                <summary className="cursor-pointer select-none">계측</summary>
                <div className="absolute right-0 bottom-9 z-30 flex w-max flex-col gap-0.5 rounded border border-line bg-surface p-2 shadow-[var(--shadow-float)]">
                  <span>레벨 {rows.level}{levelOf(axis.s) !== rows.level && <span className="text-warn-text"> (이력 유지)</span>} · s {axis.s.toFixed(2)} px/년 ({bounds.min.toFixed(2)}–{bounds.max})</span>
                  <span>스페이서 {Math.round(contentHeight(axis)).toLocaleString("ko-KR")} px · scrollTop {Math.round(scrollTop).toLocaleString("ko-KR")}</span>
                  <span>보이는 행 {buckets.length} · 청크 {chunkKeys.length}키 · 캐시 {loadedChunks} · 뷰포트 {axis.viewportH}px</span>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* 모바일 시대 스크러버(§5-7): 레일이 숨는 768px 미만에서 오른쪽 16px. 홈 열 정치체 색 띠 +
            현재 위치. 드래그하면 그 시대로 — iOS 연락처 색인처럼 */}
        <div
          ref={scrubRef}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); jumpFromScrub(e.clientY); }}
          onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") jumpFromScrub(e.clientY); }}
          className="relative w-4 shrink-0 touch-none border-l border-line bg-surface-sunken select-none md:hidden"
          title={t.minimapTitle}
        >
          {(polities[railCol] ?? []).map((p, i) => {
            const y0 = Math.max(p.y0, AXIS_YEAR_START);
            const y1 = Math.min(p.y1 ?? AXIS_YEAR_END + 1, AXIS_YEAR_END + 1);
            if (y1 <= y0) return null;
            const top = railY(y0, scrubH);
            return <div key={p.id} className="absolute inset-x-0" style={{ top, height: railY(y1, scrubH) - top, background: lugVar(i) }} />;
          })}
          <div className="absolute inset-x-0.5 rounded bg-fg/70" style={{ top: railY(centerYear(scrollTop, axis), scrubH) - 8, height: 16 }} />
        </div>
        </main>


        {/*
          상세 패널 — 폭 사다리(§5-10)와 데이터 흐름은 그대로, 안쪽만 1b로 다시 짰다.
          <1024 바텀 시트(fixed) · 1024~1440 그리드 위 overlay(absolute, 열 폭 유지) · >1440 push(static)

          머리·발은 고정이고 가운데만 스크롤한다. 출처 블록의 테두리 상자를 없애고
          border-t + 20px 여백으로 나눈다 — 상자가 넷이면 패널이 서랍장이 된다.
        */}
        {selected && (
          <aside
            ref={panelRef}
            className={`fixed inset-x-0 bottom-0 z-30 flex flex-col ${sheetFull ? "h-[100dvh]" : "h-[50svh]"} min-h-[176px] rounded-t-2xl border-t border-line bg-surface shadow-[var(--shadow-sheet)] lg:absolute lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:h-auto lg:w-[400px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-[var(--shadow-float)] wide:static wide:w-[clamp(320px,32vw,400px)] wide:shrink-0 wide:shadow-none`}
            /*
              폭에 따라 다른 것이 된다 — 격자를 덮으면(바텀 시트·오버레이) 모달 다이얼로그이고,
              나란히 밀어내면(>1440) 보조 영역이다. 한 role로 셋을 덮을 수 없다.
            */
            role={modalPanel ? "dialog" : "complementary"}
            aria-modal={modalPanel || undefined}
            aria-label={t.detailAria}
          >
            {/*
              시트 손잡이. 보이는 막대는 36×4 그대로이고 눌리는 면만 24px로 키운다
              (WCAG 2.2 SC 2.5.8 AA). 4px 막대를 손가락으로 집으라는 것은 실측 이전에
              이미 말이 안 됐다. mt-2를 버리고 그 여백을 24px 상자 안쪽으로 옮겼으므로
              막대가 놓이는 자리는 2px만 내려간다.
            */}
            <button
              type="button"
              onClick={() => setSheetFull((f) => !f)}
              className="mx-auto flex w-16 shrink-0 items-center justify-center lg:hidden"
              style={{ height: HIT_MIN }}
              aria-label={sheetFull ? t.sheetCollapse : t.sheetExpand}
            >
              <span className="block h-1 w-9 rounded-full bg-line-strong" aria-hidden />
            </button>

            {/* 머리(고정) — 날짜·열은 명조체로, 제목은 굵게 */}
            <div className="flex shrink-0 items-start justify-between gap-2 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <div className="font-serif text-meta text-fg-muted">
                  {yearLabel(selected.ev)} · {regionLabel(selected.ev.regions[0]?.r ?? "kr")}
                  {/*
                    편집 원칙(§1-6)은 "우리가 쓴 문장은 없다"였다. 제목은 이제 예외다 —
                    원천이 문장으로 쓴 연대기라 이름이 없어서 지었다. 번역을 "기계 번역"이라
                    밝히듯 이것도 밝힌다. 아래 본문에 원문이 그대로 있으므로 대조할 수 있다.
                  */}
                  {locale === "ko" && selected.ev.name_ko && (
                    <> · <span className="text-fg-subtle">{t.derivedTitle}</span></>
                  )}
                </div>
                <h2 ref={headingRef} tabIndex={-1} className="mt-0.5 text-title font-bold outline-none [text-wrap:balance] [word-break:keep-all]">
                  {(() => { const l = eventLabel(selected.ev, locale); return l.name ?? l.text; })()}
                </h2>
              </div>
              {/* 패널의 주 조작이므로 간격 예외에 기대지 않고 24px 정사각을 직접 만든다 */}
              <button
                type="button"
                onClick={() => { setSelected(null); restorePending.current = true; }}
                className="flex shrink-0 items-center justify-center rounded text-fg-subtle hover:bg-surface-hover"
                style={{ width: HIT_MIN, height: HIT_MIN }}
                aria-label={t.close}
              >
                ✕
              </button>
            </div>

            {/* 본문(스크롤) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5" style={{ overscrollBehavior: "contain" }}>
              {selected.detail === "error" ? (
                <div className="py-5">
                  <p className="text-fg-strong">{t.detailFailed}</p>
                  <p className="mt-3 flex gap-3 text-item-meta">
                    <button
                      type="button"
                      onClick={() => { setSelected((s) => (s ? { ...s, detail: null } : s)); loadDetail(selected.ev); }}
                      className="rounded border border-line-strong bg-surface px-2 py-1 hover:bg-surface-hover"
                      style={{ minHeight: HIT_MIN }}
                    >
                      {t.retry}
                    </button>
                    {/* 상세가 없어도 그 해 페이지는 서버가 그린 것이라 살아 있다 */}
                    <a href={localePath(locale, `/y/${selected.ev.y0}`)} className="self-center underline text-fg-subtle">
                      {t.yearPage(formatYearL(selected.ev.y0, locale))}
                    </a>
                  </p>
                </div>
              ) : selected.detail ? (
                <>
                  {/* 공식 연표가 맞춰진 사건은 그쪽 본문이 앞에 선다(editorial-policy §1-7) */}
                  {selected.detail.official.map((o) => (
                    <section key={o.id} className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>{t.nikh} {o.db.replace(/^주제별연표_/, "")}{o.series ? ` (${o.series})` : ""}</h3>
                      <p lang="ko" className={BLOCK_BODY}>{o.text}</p>
                      <p className={BLOCK_META}>
                        {o.date_ko}
                        {o.url && <> · <a href={o.url} target="_blank" rel="noreferrer" className="underline">{t.viewInDb}</a></>}
                      </p>
                    </section>
                  ))}
                  {selected.detail.text_ko && (
                    <section className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>{t.mt}{selected.detail.mt && ` (${selected.detail.mt.model})`}</h3>
                      <p lang="ko" className={BLOCK_BODY}>{selected.detail.text_ko}</p>
                    </section>
                  )}
                  {selected.detail.text && (
                    <section className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>
                        {t.wikiOriginal}
                        {selected.detail.lang !== locale && <span className={LANG_TAG}>{selected.detail.lang.toUpperCase()}</span>}
                      </h3>
                      {/* 번역이 아직인 원문은 진하게 — 읽어야 할 것이 그것뿐이기 때문이다 */}
                      <p lang={selected.detail.lang} className={`${BLOCK_BODY}${selected.detail.text_ko ? " text-fg-muted" : " text-fg-strong"}`}>{selected.detail.text}</p>
                      <p className={BLOCK_META}>
                        {locale === "ko" && !selected.detail.text_ko && `${t.notTranslated} · `}{selected.detail.license}
                      </p>
                    </section>
                  )}
                  {selected.detail.alt?.map((a) => (
                    <section key={a.url + a.lang} className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>{t.sameEvent(a.lang)}</h3>
                      <p lang={a.lang} className={`${BLOCK_BODY} text-fg-strong`}>{a.text}</p>
                    </section>
                  ))}
                  {/* 설명 — 연결 문서의 한국어 위키백과 첫 문단. 표제어가 인물·왕조면 그 설명이라 "관련 문서"라 부른다 */}
                  {selected.detail.about && (
                    <section className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>
                        {isEventName(selected.detail.about.title, "ko") ? t.description : t.related} · {LOCALE_LABEL.ko} Wikipedia
                      </h3>
                      <p lang="ko" className={BLOCK_BODY}>{selected.detail.about.text}</p>
                      <p className={BLOCK_META}>
                        <a href={selected.detail.about.url} target="_blank" rel="noreferrer" className="underline">{t.viewDoc}</a> ({selected.detail.about.license})
                      </p>
                    </section>
                  )}
                  {/* 이 사건을 부르는 이름 (§5-9) — 사이트링크 원문. 표가 아니라 라벨 + 값의 행이다 */}
                  {COLUMNS.some((c) => selected.ev.names[c.id]?.nat) && (
                    <section className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>{t.namesTitle}</h3>
                      <dl className="mt-1.5 space-y-1.5">
                        {COLUMNS.filter((c) => selected.ev.names[c.id]?.nat).map((c) => (
                          <div key={c.id} className="flex gap-2">
                            <dt className="w-[34px] shrink-0 text-item-meta leading-[1.6]" style={{ color: regionVar(c.id) }}>{regionLabel(c.id)}</dt>
                            <dd className="min-w-0 text-item leading-[1.6]" lang={selected.ev.names[c.id]!.lang}>{selected.ev.names[c.id]!.nat}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                  {/* 그 해 공식 연표 목록은 펼쳤을 때만 본문에 — 발의 버튼이 이것을 연다 */}
                  {officialYear && selected.ev.regions[0]?.r === "kr" && (
                    <section className={BLOCK}>
                      <h3 className={BLOCK_LABEL}>
                        {t.officialYear(formatYearL(officialYear.year, locale), officialYear.count)}
                        {officialYear.count > officialYear.shown && t.officialShown(officialYear.shown)}
                      </h3>
                      <ul lang="ko" className="mt-1.5 space-y-1.5 text-item leading-[1.6]">
                        {officialYear.entries.map((o) => (
                          <li key={o.id} className="[word-break:keep-all]">
                            <span className="text-fg-subtle tabular-nums">{o.date_ko.replace(/^.*?년\s*/, "") || t.unknownDate}</span>{" "}
                            {o.text}
                            {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="ml-1 text-fg-subtle underline">↗</a>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              ) : (
                <p className="py-5 text-fg-subtle">{t.loading}</p>
              )}
            </div>

            {/* 발(고정) — 그 해 공식 연표로 가는 버튼 + 출처·라이선스.
                실패했을 때는 본문 쪽이 「다시 시도」와 그 해 페이지 링크를 들고 있으므로 발은 접는다 */}
            {selected.detail && selected.detail !== "error" && (
              <div className="shrink-0 border-t border-line bg-surface-sunken px-5 py-3">
                {selected.ev.regions[0]?.r === "kr" && !officialYear && (
                  <button type="button" onClick={() => { const d = selected.detail; if (d && d !== "error") openOfficialYear(d.year); }} className="mb-2 rounded border border-line-strong bg-surface px-2 py-1 text-item-meta hover:bg-surface-hover">
                    {t.officialMore}
                  </button>
                )}
                <p className="text-item-meta leading-[1.6] text-fg-subtle">
                  {t.sourceLine} {selected.detail.official.length > 0 && <span>{t.nikhLicense}{selected.detail.src.length > 0 ? " · " : ""}</span>}
                  {selected.detail.src.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline">{new URL(s.url).hostname}</a>
                  ))}
                  {" · "}<a href={localePath(locale, "/sources")} className="underline">{t.licensePage}</a>
                  {" · "}<a href={localePath(locale, `/y/${selected.detail.year}`)} className="underline">{t.yearPage(formatYearL(selected.ev.y0, locale))}</a>
                  {" · "}
                  {/* 오류 신고(§11 C-8): 원문을 그대로 싣는 구조라 고칠 것은 "어느 줄을 어느 해·어느 열에"와 국사편찬위 대응뿐 */}
                  <a
                    href={`https://github.com/impactfounder/history/issues/new?${new URLSearchParams({
                      title: `[사건 오류] ${selected.ev.date_ko} · ${selected.ev.title.slice(0, 40)}`,
                      body: `사건 id: ${selected.ev.id}\n연도·열: ${selected.ev.date_ko} · ${selected.ev.regions[0]?.r}\n원문: ${selected.detail.text ?? selected.detail.official[0]?.text ?? ""}\n출처: ${[...selected.detail.src.map((s) => s.url), ...selected.detail.official.map((o) => o.url ?? o.id)].join(", ")}\n\n무엇이 틀렸나요? (연도 / 열 귀속 / 국사편찬위 대응 / 그 밖에)\n`,
                    })}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t.report}
                  </a>
                </p>
              </div>
            )}
          </aside>
        )}
      </div>

    </div>
  );
}
