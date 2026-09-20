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
   * **서버가 아는 값으로 시작한다.** 서버는 저장값을 모르므로 언제나 「시스템」이다.
   *
   * 처음에는 lazy 초기화로 localStorage를 바로 읽었는데, 그러면 서버가 그린 ◐와 클라이언트가
   * 그린 ☀가 달라 **하이드레이션이 깨졌다** — React가 그 트리를 통째로 다시 그린다(브라우저
   * 콘솔 실측 2026-09-20: "server rendered text didn't match the client", aria-label·title·
   * 글리프 셋 다 어긋남). Next 문서가 첫 줄에 적어 둔 바로 그 함정이다
   * ("A Client Component that re-renders with client values causes a hydration error").
   *
   * 색이 튀지는 않는다 — `<head>`의 인라인 스크립트가 첫 페인트 전에 `data-theme`을 붙이므로
   * 화면 전체는 이미 맞는 색이고, 여기서 뒤늦게 맞추는 것은 **13px 글리프 하나**뿐이다.
   * 그마저 `useLayoutEffect`라 페인트 전에 끝난다.
   */
  const [theme, setTheme] = useState<Theme>("system");

  /**
   * 저장값을 화면에 반영한다. 두 가지를 겸한다:
   *  · 위 상태를 실제 선택으로 올린다(서버는 모르는 값이다)
   *  · 개발 모드에서 React Strict Mode가 remount하며 지운 `<html>`의 `data-theme`을 되붙인다
   *    (프로덕션에서는 이미 붙어 있어 no-op이다)
   */
  useLayoutEffect(() => {
    const saved = readTheme();
    setTheme(saved);
    applyTheme(saved);
  }, []);

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
