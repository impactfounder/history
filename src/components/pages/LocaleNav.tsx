import { LOCALES, LOCALE_LABEL, T, localePath, type Locale } from "@/lib/i18n";

/**
 * 문서 페이지의 언어 전환 — 그리드(`?lang=`)와 달리 **링크**다. 색인 대상 페이지라 언어가 URL에 있고,
 * 그래서 전환도 그 URL로 가는 것이어야 한다(PRD §5-8). 각 링크에 hreflang을 달아 크롤러에도 같은 말을 한다.
 */
export function LocaleNav({ locale, path }: { locale: Locale; path: string }) {
  return (
    <nav className="flex gap-0.5 text-[11px]" aria-label={T[locale].language}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={localePath(l, path)}
          hrefLang={l}
          lang={l}
          title={LOCALE_LABEL[l]}
          aria-current={l === locale ? "page" : undefined}
          className={`w-7 rounded py-0.5 text-center uppercase no-underline ${l === locale ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}
