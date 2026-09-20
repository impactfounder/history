import { THEME_SCRIPT } from "@/lib/theme";

/**
 * 첫 페인트 전에 `data-theme`을 붙이는 인라인 스크립트. **두 루트 레이아웃이 함께 쓴다** —
 * `app/(ko)`와 `app/(intl)/[locale]`이 따로 있어서(`<html lang>` 때문) 빠뜨리기 쉽다.
 *
 * `<head>` 안에 두어야 한다. `<body>` 안이면 그 위 내용이 먼저 그려져 색이 한 번 튄다.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
