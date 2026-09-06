/**
 * UI 언어 — 한국어 기본, 영어·일본어·중국어 선택(대표 지시 2026-09-05, PRD §8 i18n을 P2에서 앞당김).
 *
 * 바뀌는 것: UI 문구, 열 이름, 연도 표기, 사건 라벨(위키데이터 사이트링크 — 열마다 이미 4개 언어판
 * 표제어가 있다), 정치체 라벨. 바뀌지 않는 것: 원문·설명 본문(원천 언어 그대로), 국사편찬위 항목(한국어).
 * 문서 페이지(`/y`·`/sources`)는 2026-09-06 언어별 URL로 나눴다 — 문구는 서버 전용이라 i18n-pages.tsx.
 *
 * 의존성 0. 축 라벨 규칙은 axis.ts formatRowLabel과 같은 버킷 규칙을 각 언어로 옮긴 것이다.
 */

import type { Level } from "@/lib/timeline/axis";

export type Locale = "ko" | "en" | "ja" | "zh";
export const LOCALES: readonly Locale[] = ["ko", "en", "ja", "zh"] as const;
export const isLocale = (s: string | null | undefined): s is Locale => LOCALES.includes(s as Locale);
export const LOCALE_LABEL: Record<Locale, string> = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" };

/**
 * 문서 페이지(`/y`·`/sources`)의 언어별 경로 — 한국어는 루트, 나머지는 `/{locale}` 접두.
 * 색인 대상이라 언어가 URL에 있어야 한다(PRD §5-8). 그리드(`/`)는 색인 대상이 아니라 `?lang=`을 쓴다.
 * 문구는 서버 전용이라 i18n-pages.tsx에 있지만, 이 규칙 하나는 그리드도 링크를 만들 때 쓴다.
 */
export const localePath = (locale: Locale, path: string): string => (locale === "ko" ? path : `/${locale}${path}`);
/** 접두가 붙는 언어 — `app/(intl)/[locale]`이 정적 생성하는 목록. 한국어는 여기 없다(루트에 있다). */
export const PREFIXED_LOCALES = ["en", "ja", "zh"] as const satisfies readonly Locale[];

export type RegionId = "kr" | "cn" | "jp" | "us";
/** 열 → 그 열의 자국어판(관점 명칭 원문). 사건 라벨을 언어별로 고를 때 names[열]을 쓴다. */
export const LOCALE_REGION: Record<Locale, RegionId> = { ko: "kr", en: "us", ja: "jp", zh: "cn" };

export const REGION_LABEL: Record<Locale, Record<RegionId, string>> = {
  ko: { kr: "한국", cn: "중국", jp: "일본", us: "미국" },
  en: { kr: "Korea", cn: "China", jp: "Japan", us: "United States" },
  ja: { kr: "韓国", cn: "中国", jp: "日本", us: "アメリカ" },
  zh: { kr: "韩国", cn: "中国", jp: "日本", us: "美国" },
};

export interface Strings {
  siteHint: string;
  badgePreview: (n: number) => string;
  badge: (n: number) => string;
  noData: string;
  recommended: string;
  sources: string;
  railTitle: string;
  timelineAria: string;
  addColumn: string;
  colLeft: (c: string) => string;
  colRight: (c: string) => string;
  colRemove: (c: string) => string;
  traditional: string;
  officialMark: string;
  detailAria: string;
  sheetExpand: string;
  sheetCollapse: string;
  close: string;
  importance: string;
  nikh: string;
  viewInDb: string;
  wikiOriginal: string;
  notTranslated: string;
  mt: string;
  sameEvent: (lang: string) => string;
  description: string;
  related: string;
  viewDoc: string;
  officialMore: string;
  officialYear: (year: string, n: number) => string;
  officialShown: (n: number) => string;
  unknownDate: string;
  sourceLine: string;
  nikhLicense: string;
  licensePage: string;
  yearPage: (year: string) => string;
  report: string;
  loading: string;
  zoomGroup: string;
  zoomOut: string;
  zoomIn: string;
  level: Record<Exclude<Level, "month">, string>;
  center: string;
  ariaSheetHandle: string;
  language: string;
  /** 재위 시작 라벨 — 위키데이터 P39/P580에서 온 줄에 붙인다(구조 라벨, 우리가 쓴 문장이 아니다). */
  accession: string;
  /** 첫 방문 1회 힌트(§5-7 착지) — 폰과 데스크톱 문구가 다르다. */
  hintTouch: string;
  hintDesktop: string;
  hintClose: string;
}

export const T: Record<Locale, Strings> = {
  ko: {
    siteHint: "시간 이동은 스크롤 · 확대는 Ctrl+휠 또는 +/−",
    badgePreview: (n) => `미리보기 · ${n.toLocaleString("ko-KR")}건 · 원문 그대로 · 2025년까지`,
    badge: (n) => `${n.toLocaleString("ko-KR")}건 · 2025년까지 수록`,
    noData: "데이터 없음",
    recommended: "추천 연도",
    sources: "출처",
    railTitle: "시대 레일 — 클릭하면 그 시대로 점프",
    timelineAria: "시간축. 위아래 화살표로 이동, 칩에서 좌우 화살표로 옆 열, Enter로 상세, Esc로 닫기",
    addColumn: "+ 열",
    colLeft: (c) => `${c} 열 왼쪽으로`,
    colRight: (c) => `${c} 열 오른쪽으로`,
    colRemove: (c) => `${c} 열 빼기`,
    traditional: "(전승)",
    officialMark: "국사편찬위원회 연표에 있는 사건",
    detailAria: "사건 상세",
    sheetExpand: "시트 늘리기",
    sheetCollapse: "시트 줄이기",
    close: "닫기",
    importance: "중요도",
    nikh: "국사편찬위원회",
    viewInDb: "한국사데이터베이스에서 보기",
    wikiOriginal: "위키백과 연표 원문",
    notTranslated: "한글 옮김은 아직",
    mt: "한국어 · 기계 번역",
    sameEvent: (lang) => `같은 사건 · ${lang} 위키백과 연표 원문`,
    description: "설명",
    related: "관련 문서",
    viewDoc: "문서 보기",
    officialMore: "이 해의 공식 연표 더 보기",
    officialYear: (year, n) => `${year}의 국사편찬위원회 연표 ${n}건`,
    officialShown: (n) => ` 중 ${n}건`,
    unknownDate: "날짜 미상",
    sourceLine: "출처",
    nikhLicense: "국사편찬위원회 연표(공공누리 · 제한 없음)",
    licensePage: "출처와 라이선스",
    yearPage: (year) => `${year} 페이지`,
    report: "오류 신고",
    loading: "불러오는 중…",
    zoomGroup: "확대·축소",
    zoomOut: "축소",
    zoomIn: "확대",
    level: { century: "세기", decade: "십년", year: "연도" },
    center: "중앙",
    ariaSheetHandle: "시트 크기",
    language: "언어",
    accession: "즉위",
    hintTouch: "스크롤로 시간 이동 · 두 손가락으로 확대",
    hintDesktop: "스크롤로 시간 이동 · Ctrl+휠로 확대",
    hintClose: "닫기",
  },
  en: {
    siteHint: "Scroll to move in time · Ctrl+wheel or +/− to zoom",
    badgePreview: (n) => `Preview · ${n.toLocaleString("en-US")} events · verbatim sources · through 2025`,
    badge: (n) => `${n.toLocaleString("en-US")} events · through 2025`,
    noData: "No data",
    recommended: "Suggested years",
    sources: "Sources",
    railTitle: "Era rail — click to jump",
    timelineAria: "Timeline. Arrow keys to move; on a chip, left/right for the next column, Enter for details, Esc to close",
    addColumn: "+ Column",
    colLeft: (c) => `Move ${c} column left`,
    colRight: (c) => `Move ${c} column right`,
    colRemove: (c) => `Remove ${c} column`,
    traditional: "(traditional)",
    officialMark: "Also in the National Institute of Korean History chronology",
    detailAria: "Event details",
    sheetExpand: "Expand sheet",
    sheetCollapse: "Shrink sheet",
    close: "Close",
    importance: "importance",
    nikh: "National Institute of Korean History",
    viewInDb: "Open in the Korean History Database",
    wikiOriginal: "Wikipedia timeline, verbatim",
    notTranslated: "not translated yet",
    mt: "Korean · machine translation",
    sameEvent: (lang) => `Same event · ${lang} Wikipedia timeline`,
    description: "About",
    related: "Related article",
    viewDoc: "Open article",
    officialMore: "More official chronology for this year",
    officialYear: (year, n) => `NIKH chronology for ${year}: ${n} entries`,
    officialShown: (n) => `, showing ${n}`,
    unknownDate: "date unknown",
    sourceLine: "Sources",
    nikhLicense: "NIKH chronology (KOGL, open)",
    licensePage: "Sources & licenses",
    yearPage: (year) => `Page for ${year}`,
    report: "Report an error",
    loading: "Loading…",
    zoomGroup: "Zoom",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    level: { century: "Century", decade: "Decade", year: "Year" },
    center: "Center",
    ariaSheetHandle: "Sheet size",
    language: "Language",
    accession: "accession",
    hintTouch: "Scroll to move in time · pinch to zoom",
    hintDesktop: "Scroll to move in time · Ctrl+wheel to zoom",
    hintClose: "Close",
  },
  ja: {
    siteHint: "スクロールで移動 · Ctrl+ホイールまたは +/− で拡大",
    badgePreview: (n) => `プレビュー · ${n.toLocaleString("ja-JP")}件 · 原文のまま · 2025年まで`,
    badge: (n) => `${n.toLocaleString("ja-JP")}件 · 2025年まで`,
    noData: "データなし",
    recommended: "おすすめの年",
    sources: "出典",
    railTitle: "時代レール — クリックで移動",
    timelineAria: "年表。上下矢印で移動、チップ上で左右矢印で隣の列、Enterで詳細、Escで閉じる",
    addColumn: "+ 列",
    colLeft: (c) => `${c}列を左へ`,
    colRight: (c) => `${c}列を右へ`,
    colRemove: (c) => `${c}列を外す`,
    traditional: "（伝承）",
    officialMark: "韓国 国史編纂委員会の年表にもある出来事",
    detailAria: "出来事の詳細",
    sheetExpand: "シートを広げる",
    sheetCollapse: "シートを縮める",
    close: "閉じる",
    importance: "重要度",
    nikh: "国史編纂委員会（韓国）",
    viewInDb: "韓国史データベースで見る",
    wikiOriginal: "Wikipedia年表の原文",
    notTranslated: "未翻訳",
    mt: "韓国語 · 機械翻訳",
    sameEvent: (lang) => `同じ出来事 · ${lang}版Wikipedia年表の原文`,
    description: "説明",
    related: "関連記事",
    viewDoc: "記事を見る",
    officialMore: "この年の公式年表をもっと見る",
    officialYear: (year, n) => `${year}の国史編纂委員会年表 ${n}件`,
    officialShown: (n) => ` のうち${n}件`,
    unknownDate: "日付不明",
    sourceLine: "出典",
    nikhLicense: "国史編纂委員会年表（KOGL・制限なし）",
    licensePage: "出典とライセンス",
    yearPage: (year) => `${year}のページ`,
    report: "誤りを報告",
    loading: "読み込み中…",
    zoomGroup: "拡大・縮小",
    zoomOut: "縮小",
    zoomIn: "拡大",
    level: { century: "世紀", decade: "十年", year: "年" },
    center: "中央",
    ariaSheetHandle: "シートの大きさ",
    language: "言語",
    accession: "即位",
    hintTouch: "スクロールで移動 · 二本指で拡大",
    hintDesktop: "スクロールで移動 · Ctrl+ホイールで拡大",
    hintClose: "閉じる",
  },
  zh: {
    siteHint: "滚动移动时间 · Ctrl+滚轮或 +/− 缩放",
    badgePreview: (n) => `预览 · ${n.toLocaleString("zh-CN")}条 · 原文照录 · 至2025年`,
    badge: (n) => `${n.toLocaleString("zh-CN")}条 · 收录至2025年`,
    noData: "无数据",
    recommended: "推荐年份",
    sources: "来源",
    railTitle: "时代导轨 — 点击跳转",
    timelineAria: "时间轴。上下方向键移动，在条目上按左右键切换到相邻列，Enter查看详情，Esc关闭",
    addColumn: "+ 列",
    colLeft: (c) => `将${c}列左移`,
    colRight: (c) => `将${c}列右移`,
    colRemove: (c) => `移除${c}列`,
    traditional: "（传说）",
    officialMark: "亦见于韩国国史编纂委员会年表",
    detailAria: "事件详情",
    sheetExpand: "展开面板",
    sheetCollapse: "收起面板",
    close: "关闭",
    importance: "重要度",
    nikh: "国史编纂委员会（韩国）",
    viewInDb: "在韩国史数据库查看",
    wikiOriginal: "维基百科年表原文",
    notTranslated: "尚未翻译",
    mt: "韩语 · 机器翻译",
    sameEvent: (lang) => `同一事件 · ${lang}语维基百科年表原文`,
    description: "说明",
    related: "相关条目",
    viewDoc: "查看条目",
    officialMore: "查看本年更多官方年表",
    officialYear: (year, n) => `${year}国史编纂委员会年表 ${n}条`,
    officialShown: (n) => `，显示${n}条`,
    unknownDate: "日期不详",
    sourceLine: "来源",
    nikhLicense: "国史编纂委员会年表（KOGL·无限制）",
    licensePage: "来源与许可",
    yearPage: (year) => `${year}页面`,
    report: "报告错误",
    loading: "加载中…",
    zoomGroup: "缩放",
    zoomOut: "缩小",
    zoomIn: "放大",
    level: { century: "世纪", decade: "十年", year: "年" },
    center: "中心",
    ariaSheetHandle: "面板大小",
    language: "语言",
    accession: "即位",
    hintTouch: "滚动移动时间 · 双指缩放",
    hintDesktop: "滚动移动时间 · Ctrl+滚轮缩放",
    hintClose: "关闭",
  },
};

// ── 연도 표기 ────────────────────────────────────────────────────────────────
/** 단일 연도. 천문학적 연수(1 BC = 0)를 각 언어의 관용대로. */
export function formatYearL(year: number, locale: Locale): string {
  const bc = year <= 0, n = bc ? 1 - year : year;
  switch (locale) {
    case "ko": return bc ? `기원전 ${n}년` : `${n}년`;
    case "en": return bc ? `${n} BC` : `${n}`;
    case "ja": return bc ? `紀元前${n}年` : `${n}年`;
    case "zh": return bc ? `公元前${n}年` : `${n}年`;
  }
}

const ROW_UNIT: Record<Exclude<Level, "month">, number> = { century: 100, decade: 10, year: 1 };

/** 행 라벨. axis.ts formatRowLabel(한국어)과 같은 버킷 규칙 — 기원전은 범위 표기, 경계 버킷은 양쪽 표기. */
export function formatRowLabelL(bucket: number, level: Level, locale: Locale): string {
  if (level === "month") throw new Error("월 레벨 라벨은 P1에서 정의한다.");
  const unit = ROW_UNIT[level];
  const end = bucket + unit - 1;
  if (bucket >= 1) {
    if (unit === 1) return formatYearL(bucket, locale);
    switch (locale) {
      case "ko": return `${bucket}년대`;
      case "en": return `${bucket}s`;
      default: return `${bucket}年代`;
    }
  }
  // 기원전 범위는 "년"을 뗀다 — 40px 거터에서 "기원전 801–792년"이 세 줄로 감겨 다음 행과 겹쳤다(2026-09-05)
  if (end <= 0) {
    if (unit === 1) return formatYearL(bucket, locale);
    const a = 1 - bucket, b = 1 - end;
    switch (locale) {
      case "ko": return `기원전 ${a}–${b}`;
      case "en": return `${a}–${b} BC`;
      case "ja": return `紀元前${a}–${b}`;
      case "zh": return `公元前${a}–${b}`;
    }
  }
  // 기원전과 서기가 한 버킷에 걸치는 경계
  switch (locale) {
    case "ko": return `기원전 ${1 - bucket}–서기 ${end}`;
    case "en": return `${1 - bucket} BC–AD ${end}`;
    case "ja": return `紀元前${1 - bucket}–西暦${end}`;
    case "zh": return `公元前${1 - bucket}–公元${end}`;
  }
}

// ── 사건 라벨 ────────────────────────────────────────────────────────────────
/**
 * 그 언어의 표제어가 **사건**을 가리키는가. QID는 인물·왕조·지명일 때가 많아(이시진, 도요토미 히데요시,
 * 청나라, 콜로라도주) 그 이름만 칩에 쓰면 무슨 일인지 사라진다. 사건 이름 꼴일 때만 이름만으로 충분.
 */
// 사건 이름 판정은 src/lib/event-name.mjs — 중요도 순위(tools/derive.mjs)와 같은 규칙을 쓴다
import { isEventName as isEventNameJs } from "./event-name.mjs";
export const isEventName = (name: string, locale: Locale): boolean => isEventNameJs(name, locale);

/** 발행 사건 레코드에서 라벨을 고르는 데 필요한 부분. */
export interface LabelSource {
  title: string;
  title_ko?: string;
  lang: string;
  names: Partial<Record<RegionId, { nat?: string; lang?: string }>>;
  /** 위키데이터에서 온 구조 라벨. "accession" = 재위 시작 — 인물 이름 뒤에 언어별 "즉위"를 붙인다. */
  role?: string;
}

/** 그 언어의 표제어(괄호 구분자 제거). 없으면 undefined. */
export function nameIn(ev: LabelSource, locale: Locale): string | undefined {
  return ev.names[LOCALE_REGION[locale]]?.nat?.replace(/\s*\([^)]*\)$/, "") || undefined;
}

/** 원문이 UI 언어와 같은 언어인가(같으면 "이름 · 원문" 접두가 중복이다). */
const SAME_LANG: Record<Locale, string> = { ko: "ko", en: "en", ja: "ja", zh: "zh" };

/**
 * ko 「한국사 연표」 표 행은 한 줄에 여러 사건이 쉼표로 묶여 있다 — "조미수호조규 체결 외 3".
 * 다른 언어 원문에는 쓰지 않는다(영어 쉼표는 절 구분).
 */
const shortKo = (title: string): string => {
  const segs = title.split(/,\s+/).filter((s) => s.trim());
  return segs.length > 1 ? `${segs[0]} 외 ${segs.length - 1}` : title;
};

/**
 * 칩 라벨(짧게 — 대표 지시 2026-09-05). 형식은 둘뿐이다:
 *  1) UI 언어 표제어가 **사건 꼴**이고 셀 안에 같은 이름이 하나뿐이면 그 이름만
 *  2) 아니면 원문(ko UI면 기계 번역 우선, ko 원문의 묶인 줄은 "첫 사건 외 N")
 * 지명·인물·기관 표제어("기이반도", "이시진")는 붙이지 않는다 — "기이반도 · March — According to…"처럼
 * 정보가 안 되고 형식만 섞인다(2026-09-05). 그 이름들은 상세의 관점별 명칭 표에 있다.
 * @param dupNames 같은 셀에서 둘 이상 나오는 표제어 — 그 경우 원문으로
 */
export function eventLabel(ev: LabelSource, locale: Locale, dupNames?: ReadonlySet<string>): { name?: string; text?: string } {
  const name = nameIn(ev, locale);
  // 재위 시작: 인물 이름 + 언어별 "즉위". 이름만으로는 무슨 일인지 알 수 없다
  if (ev.role === "accession") {
    const who = name ?? ev.title;
    return { name: locale === "en" ? `${who}, ${T.en.accession}` : `${who} ${T[locale].accession}` };
  }
  const dup = name !== undefined && dupNames?.has(name) === true;
  if (name && !dup && isEventName(name, locale)) return { name };
  if (ev.lang === SAME_LANG[locale]) return { text: locale === "ko" ? shortKo(ev.title) : ev.title };
  if (locale === "ko" && ev.title_ko) return { text: ev.title_ko };
  return { text: ev.title };
}
