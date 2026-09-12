import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { SOURCES } from "@/lib/i18n-pages";
import { LocaleNav } from "@/components/pages/LocaleNav";

/**
 * 출처 페이지 본문 — editorial-policy §1-6·§1-7, PRD §7(A-15·A-16).
 * 본문은 우리가 쓴 문장이 아니라 원천의 원문이다. 그래서 라이선스 고지가 제품의 일부다.
 * 위키백과는 CC BY-SA 4.0(동일 조건 — 이 사이트의 사건 본문도 같은 조건으로 나간다),
 * 국사편찬위원회 연표는 공공누리 제1유형(이용허락범위 제한 없음).
 *
 * 레이아웃은 하나, 문구는 언어별(i18n-pages SOURCES) — 네 벌을 각각 손으로 배치하면 서로 어긋난다.
 *
 * 1b: README §화면의 마지막 화면이고 아트보드가 없다. 연도 페이지에서 확정된 문서 규칙을 따른다 —
 * 명조 h1 + 16px 본문 + 실낱 구분선. 절 사이를 여백이 아니라 선으로 나누는 이유는 상세 패널과 같다:
 * 읽는 페이지에서 여백만으로 나누면 어디까지가 한 절인지 눈이 못 잡는다.
 * **명조는 h1에만** 붙인다 — 서체는 시간 채널 전용이라 붙는 곳이 넷뿐이다(globals.css --font-serif).
 * 본문 폭은 max-w-2xl 그대로다. 연도 페이지가 5xl인 것은 네 열 표이기 때문이고, 여기는 산문이다.
 */
export function SourcesArticle({ locale }: { locale: Locale }) {
  const c = SOURCES[locale];
  const gridHref = locale === "ko" ? "/" : `/?lang=${locale}`;

  /** 절 하나. 첫 절은 윗선을 지운다 — 제목 바로 아래 선이 두 줄로 겹친다. */
  const SECTION = "border-t border-line-hairline pt-7 pb-7 first:border-t-0";

  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl px-12 py-11 [text-wrap:pretty] [word-break:keep-all]">
        <div className="mb-7 flex items-start justify-between gap-4">
          <p className="text-item-meta">
            <Link href={gridHref} className="text-fg-subtle underline">{c.back}</Link>
          </p>
          <LocaleNav locale={locale} path="/sources" />
        </div>

        <h1 className="font-serif text-h1 font-semibold tracking-[-.02em] [text-wrap:balance]">{c.title}</h1>
        <p className="mt-3 text-lead text-fg-strong">{c.intro}</p>

        <div className="mt-9">
          <section className={SECTION}>
            <h2 className="text-h2 font-semibold">{c.wiki.h}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-lead text-fg-strong">
              {c.wiki.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-3 text-lead text-fg-strong">{c.wiki.body}</p>
          </section>

          <section className={SECTION}>
            <h2 className="text-h2 font-semibold">{c.nikh.h}</h2>
            <p className="mt-3 text-lead text-fg-strong">{c.nikh.lead}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-lead text-fg-strong">
              {c.nikh.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-3 text-lead text-fg-strong">{c.nikh.body}</p>
          </section>

          <section className={SECTION}>
            <h2 className="text-h2 font-semibold">{c.names.h}</h2>
            <p className="mt-3 text-lead text-fg-strong">{c.names.body}</p>
          </section>
        </div>

        {/* 출처 줄 — 우측 정렬하지 않는다. 읽는 페이지의 마지막 줄은 본문과 같은 왼쪽 끝에 선다 */}
        <p className="border-t border-line-hairline pt-5 text-meta text-fg-subtle">{c.foot}</p>
      </article>
    </main>
  );
}
