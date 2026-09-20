"use client";

import { useLayoutEffect, useState } from "react";

import { HIT_MIN } from "@/lib/design/metrics";
import type { Strings } from "@/lib/i18n";
import { THEMES, type Theme, applyTheme, readTheme, writeTheme } from "@/lib/theme";

/**
 * 테마 선택 — **시스템 · 라이트 · 다크 세 상태.** 「시스템」이 기본이고, 속성을 지우는 것이
 * 시스템으로 돌아가는 길이다(`lib/theme.ts`).
 *
 * 다크 팔레트는 2026-09-09부터 `globals.css`에 다 들어 있었는데 **아무도 켤 수 없었다** —
 * `data-theme`을 읽거나 쓰는 코드가 한 줄도 없어서 OS 설정만 따랐다. 이것이 그 스위치다.
 *
 * 세 상태를 한 자리에서 돌린다(라디오 셋이 아니라 순환 버튼). 상단바가 44px 한 줄이고
 * 「자리 고정」 규약상 언어를 바꿔도 폭이 변하면 안 되기 때문이다 — 글리프 하나는 항상 같은 폭이다.
 * 지금 상태는 `aria-label`이 말하고, 다음에 무엇이 되는지는 `title`이 말한다.
 */
const GLYPH: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

export function ThemeToggle({ t, className = "" }: { t: Strings; className?: string }) {
  /**
   * 서버는 저장값을 모른다. lazy 초기화로 **인라인 스크립트와 같은 곳**에서 읽어 둘이 어긋나지
   * 않게 한다(Next 문서 `preventing-flash-before-hydration` §Syncing with React state).
   */
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "system" : readTheme()));

  /**
   * 개발 모드에서 React Strict Mode가 한 번 remount하며 `<html>`의 속성을 JSX가 아는 것만 남기고
   * 지운다 — 인라인 스크립트가 붙인 `data-theme`이 그때 날아간다. 프로덕션에서는 no-op이다.
   */
  useLayoutEffect(() => { applyTheme(readTheme()); }, []);

  const pick = (next: Theme) => { setTheme(next); writeTheme(next); applyTheme(next); };
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;

  return (
    <button
      type="button"
      onClick={() => pick(next)}
      aria-label={`${t.theme}: ${t.themeName[theme]}`}
      title={t.themeNext(t.themeName[next])}
      style={{ minWidth: HIT_MIN, minHeight: HIT_MIN }}
      className={`flex shrink-0 items-center justify-center text-meta text-fg-subtle hover:text-fg ${className}`}
    >
      <span aria-hidden>{GLYPH[theme]}</span>
    </button>
  );
}
