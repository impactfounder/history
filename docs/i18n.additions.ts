/**
 * src/lib/i18n.ts에 더하고 뺄 것.
 *
 * Strings 인터페이스와 T의 네 언어 항목 모두에 반영한다(TS가 빠진 것을 잡아 준다).
 */

// ── Strings 인터페이스에 더한다 ──────────────────────────────────────────────
export interface StringsAdditions {
  /** `+26` → `26건 더`. 셀 오른쪽 아래 배지. */
  moreCount: (n: number) => string;
  /** plain 항목의 메타 줄에 붙는 원문 표기. `원문 EN` */
  originalIn: (lang: string) => string;
  /** 국사편찬위원회 연표에 있는 항목의 메타 줄. ◆ 글리프를 대체한다. */
  nikhShort: string;
  /** 떠 있는 줌 컨트롤 안의 조작 힌트. 기존 siteHint(45자)를 대체한다. */
  zoomHint: string;
  /** 축 미니맵의 title. 기존 railTitle을 대체한다. */
  minimapTitle: string;
}

// ── T에 더한다 ──────────────────────────────────────────────────────────────
export const ADDITIONS = {
  ko: {
    moreCount: (n: number) => `${n.toLocaleString("ko-KR")}건 더`,
    originalIn: (lang: string) => `원문 ${lang.toUpperCase()}`,
    nikhShort: "국사편찬위원회 연표",
    zoomHint: "Ctrl+휠",
    minimapTitle: "시대 미니맵 — 클릭하면 그 시대로",
  },
  en: {
    moreCount: (n: number) => `${n.toLocaleString("en-US")} more`,
    originalIn: (lang: string) => `verbatim ${lang.toUpperCase()}`,
    nikhShort: "NIKH chronology",
    zoomHint: "Ctrl+wheel",
    minimapTitle: "Era minimap — click to jump",
  },
  ja: {
    moreCount: (n: number) => `他 ${n.toLocaleString("ja-JP")}件`,
    originalIn: (lang: string) => `原文 ${lang.toUpperCase()}`,
    nikhShort: "国史編纂委員会 年表",
    zoomHint: "Ctrl+ホイール",
    minimapTitle: "時代ミニマップ — クリックで移動",
  },
  zh: {
    moreCount: (n: number) => `另 ${n.toLocaleString("zh-CN")}条`,
    originalIn: (lang: string) => `原文 ${lang.toUpperCase()}`,
    nikhShort: "国史编纂委员会年表",
    zoomHint: "Ctrl+滚轮",
    minimapTitle: "时代缩略轴 — 点击跳转",
  },
} as const;

/*
  ── 뺀다 ────────────────────────────────────────────────────────────────────
  hintTouch · hintDesktop · hintClose
    첫 방문 1회 힌트 알약을 없앤다. 조작법은 떠 있는 줌 컨트롤 안의 zoomHint에
    상시 있으므로 localStorage("history:hintSeen")도 함께 지운다.

  siteHint
    상단바 오른쪽 330px 고정 폭 안내문. 44px 상단바에 자리가 없고, 같은 내용이
    줌 컨트롤에 있다. zoomHint가 대체한다.

  railTitle → minimapTitle로 이름을 바꾼다.

  officialMark ("국사편찬위원회 연표에 있는 사건")
    ◆ 글리프의 title이었다. 이제 메타 줄에 nikhShort가 글자로 나오므로 title이 필요 없다.
    상세 패널의 라벨로는 계속 쓴다.

  ── 그대로 둔다 ──────────────────────────────────────────────────────────────
  level(세기·십년·연도) · center · zoomIn/Out/Group · traditional · 상세 패널 문구 전부.
*/
