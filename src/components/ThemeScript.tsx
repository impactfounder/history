import { THEME_SCRIPT } from "@/lib/theme";

/**
 * 첫 페인트 전에 `data-theme`을 붙이는 인라인 스크립트. **두 루트 레이아웃이 함께 쓴다** —
 * `app/(ko)`와 `app/(intl)/[locale]`이 따로 있어서(`<html lang>` 때문) 빠뜨리기 쉽다.
 *
 * `<head>` 안에 두어야 한다. `<body>` 안이면 그 위 내용이 먼저 그려져 색이 한 번 튄다.
 */
export function ThemeScript() {
  /*
    `type`을 서버에서만 실행 가능하게 둔다. 이 태그는 **첫 HTML에만 의미가 있고**, 클라이언트
    렌더에서 다시 만들어져도 브라우저가 실행하지 않는다 — React가 개발 모드에서 그 사실을
    경고한다("Encountered a script tag while rendering React component", 실측 2026-09-20).
    Next 문서 `preventing-flash-before-hydration`의 `InlineScript` 처방 그대로다.
  */
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
