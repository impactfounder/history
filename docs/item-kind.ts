/**
 * 항목의 표시 등급 — 1b의 2단 위계.
 *
 * ── 왜 중요도가 아니라 '읽히는가'인가 ────────────────────────────────────────
 * 실측(십년 레벨 착지 화면, 2026-09-09 발행분): 화면에 뜬 48건 중 15건(31%)이
 * 한국어 UI인데 영어·중국어 원문 문장이었다. 그 15건은 길고, 잘리고, 문장 부호로
 * 시작하고("月19日，…", "August. The Axe Murder…"), 눈이 걸리는 자리마다 있었다.
 * 지저분함의 가장 큰 단일 원인이 이것이다.
 *
 * 기존 3단 위계(중요도 티어 → 14/13/12px)는 이 사실을 표현하지 못했다. 티어 1의
 * 굵은 14px이 영어 원문 한 문장일 수도 있고 「임진왜란」일 수도 있었다.
 *
 * 2단으로 바꾸면 위계가 사용자의 실제 경험과 일치한다:
 *   lead  — UI 언어로 읽히는 것. 15px/600, fg. 훑어볼 수 있다.
 *   plain — 원문 그대로인 것. 13px/400, fg-muted + 언어 태그. 건너뛸 수 있다.
 *
 * 번역이 채워지면(tools/translate.mjs) plain이 저절로 lead로 올라간다 —
 * 디자인이 데이터 품질의 계기판이 된다.
 *
 * 중요도 티어(rank.ts)는 없애지 않는다. 셀 안 선별 순서와 기간 프레임 자격에 계속 쓴다.
 * 다만 **글자 크기에는 더 이상 쓰지 않는다.**
 *
 * 의존성 0, DOM 접근 0. axis.ts와 같은 규약.
 */

import { LOCALE_REGION, eventLabel, type LabelSource, type Locale } from "@/lib/i18n";

/** UI 언어의 원천 언어 코드. i18n.ts의 SAME_LANG과 같은 표다. */
const LOCALE_LANG: Record<Locale, string> = { ko: "ko", en: "en", ja: "ja", zh: "zh" };

export type ItemKind = "lead" | "plain";

/** 기계 번역까지 갖춘 최소 형태. */
export interface KindSource extends LabelSource {
  lang: string;
  title_ko?: string;
}

/**
 * 이 항목이 UI 언어로 읽히는가.
 *
 * 세 경우가 lead다:
 *   1) 그 언어의 표제어가 **사건 이름 꼴**이라 라벨이 이름으로 떨어진다(eventLabel의 name)
 *      — 「임진왜란」, 「6.25 전쟁」, 「얄타 회담」, 재위 시작의 「… 즉위」
 *   2) 원문이 이미 UI 언어다 — ko 원문 줄("9월 18일 남북한이 유엔(UN) 동시 가입")
 *   3) ko UI이고 기계 번역이 있다(title_ko) — 읽히는 한국어 문장이다
 *
 * 그 밖은 plain이다. 지명·인물·기관 표제어("기이반도", "이시진")는 eventLabel이
 * 이름으로 쓰지 않으므로 자동으로 plain으로 떨어진다 — 의도한 결과다.
 */
export function itemKind(ev: KindSource, locale: Locale): ItemKind {
  if (eventLabel(ev, locale).name !== undefined) return "lead";
  if (ev.lang === LOCALE_LANG[locale]) return "lead";
  if (locale === "ko" && ev.title_ko) return "lead";
  return "plain";
}

/**
 * plain 항목에 붙는 언어 태그. 어느 언어판 원문인지 두 글자로 알린다.
 * lead에는 붙이지 않는다 — 읽히는 것에 태그를 붙이면 소음이 된다.
 */
export function originalTag(ev: KindSource, locale: Locale): string | undefined {
  return itemKind(ev, locale) === "plain" ? ev.lang.toUpperCase() : undefined;
}

/** 이 항목이 `nameIn` 표제어와 원문을 함께 보여야 하는가(같은 셀 중복 이름). */
export const localeRegionOf = (locale: Locale) => LOCALE_REGION[locale];
