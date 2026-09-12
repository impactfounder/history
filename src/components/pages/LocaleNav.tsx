import { LOCALES, LOCALE_LABEL, T, localePath, type Locale } from "@/lib/i18n";

/**
 * 문서 페이지의 언어 전환 — 그리드(`?lang=`)와 달리 **링크**다. 색인 대상 페이지라 언어가 URL에 있고,
 * 그래서 전환도 그 URL로 가는 것이어야 한다(PRD §5-8). 각 링크에 hreflang을 달아 크롤러에도 같은 말을 한다.
 */
export function LocaleNav({ locale, path }: { locale: Locale; path: string }) {
  return (
    // 색은 토큰으로만(AGENTS.md). 웜 페이퍼 계단 위에 순수 무채색 알약이 남아 있으면 색온도가 어긋난다.
    // 모양(w-7 알약)은 그대로 뒀다 — README §손대지 않는 것이 이 파일을 제외했고, 여기서 바꿔야 할 것은
    // 규칙 위반뿐이다. 그리드 상단바처럼 텍스트 링크로 갈지는 따로 정할 일이다.
    <nav className="flex gap-0.5 text-item-meta" aria-label={T[locale].language}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={localePath(l, path)}
          hrefLang={l}
          lang={l}
          title={LOCALE_LABEL[l]}
          aria-current={l === locale ? "page" : undefined}
          className={`w-7 rounded py-0.5 text-center uppercase no-underline ${l === locale ? "bg-surface-inverse text-fg-inverse" : "text-fg-subtle hover:bg-surface-hover"}`}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}
