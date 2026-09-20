/**
 * 테마 선택 — **세 상태다.** 「시스템」은 값이 없는 것이 아니라 상태 하나다.
 *
 * `globals.css` `[3]`이 그렇게 쓰여 있다:
 *
 *   @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }
 *   :root[data-theme="dark"] { … }
 *
 * 즉 **속성이 없으면 시스템을 따르고**, `light`는 시스템이 다크여도 라이트로 묶고,
 * `dark`는 시스템이 라이트여도 다크로 묶는다. 그래서 `<html>`에 `data-theme="light"`를
 * 기본값으로 박아 두면 안 된다 — 그 순간 시스템 다크를 따르는 길이 사라진다.
 * (Next 문서 `preventing-flash-before-hydration`의 예제는 그렇게 하지만, 그 예제의 CSS는
 * 두 상태뿐이라 우리와 전제가 다르다.)
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** localStorage 키. 이 값은 `THEME_SCRIPT`도 쓴다 — 어긋나면 첫 페인트가 틀린다. */
export const THEME_KEY = "history:theme";

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/** `data-theme` 속성값. 「시스템」은 속성을 지운다. */
export const themeAttr = (t: Theme): string | null => (t === "system" ? null : t);

/** `<html>`에 적용한다. 되돌릴 때 속성을 **지우는** 것이 시스템으로 돌아가는 길이다. */
export function applyTheme(t: Theme): void {
  const el = document.documentElement;
  const a = themeAttr(t);
  if (a) el.setAttribute("data-theme", a);
  else el.removeAttribute("data-theme");
}

/** 저장된 선택. 없거나 못 읽으면 「시스템」. */
export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function writeTheme(t: Theme): void {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* 사생활 보호 모드 등 — 화면은 이미 바뀌었고 기억만 못 한다 */
  }
}

/**
 * **첫 페인트 전에** 도는 인라인 스크립트(`<head>`). HTML을 파싱하는 동안 동기로 실행되므로
 * React가 로드되기도 전에 속성이 붙는다 — `useLayoutEffect`로는 늦다(느린 연결에서 서버 HTML이
 * 먼저 그려진다).
 *
 * `try/catch`는 localStorage를 못 읽는 경우(사생활 보호 모드·사이트 데이터 차단)를 받는다.
 * 저장값이 없으면 **아무것도 하지 않는다** — 속성이 없는 것이 「시스템을 따른다」이기 때문이다.
 *
 * 키와 값이 위 상수와 어긋나면 첫 페인트만 틀리고 이후 토글은 맞아, 증상이 "새로고침하면
 * 잠깐 반대 색"으로만 보인다. `theme.test.ts`가 그 어긋남을 막는다.
 */
export const THEME_SCRIPT =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});` +
  `if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
