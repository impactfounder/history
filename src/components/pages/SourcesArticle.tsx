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
 */
export function SourcesArticle({ locale }: { locale: Locale }) {
  const c = SOURCES[locale];
  const gridHref = locale === "ko" ? "/" : `/?lang=${locale}`;

  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl px-6 py-10 text-[14px] leading-relaxed [text-wrap:pretty] [word-break:keep-all]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <p className="text-[12px]">
            <Link href={gridHref} className="text-neutral-500 underline">{c.back}</Link>
          </p>
          <LocaleNav locale={locale} path="/sources" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight [text-wrap:balance]">{c.title}</h1>
        <p className="mb-8 text-neutral-600">{c.intro}</p>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">{c.wiki.h}</h2>
          <ul className="mb-3 list-disc pl-5 text-neutral-700">
            {c.wiki.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p className="text-neutral-700">{c.wiki.body}</p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">{c.nikh.h}</h2>
          <p className="mb-3 text-neutral-700">{c.nikh.lead}</p>
          <ul className="mb-3 list-disc pl-5 text-neutral-700">
            {c.nikh.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p className="text-neutral-700">{c.nikh.body}</p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">{c.names.h}</h2>
          <p className="mb-2 text-neutral-700">{c.names.body}</p>
        </section>

        <section className="text-[12px] text-neutral-500">
          <p>{c.foot}</p>
        </section>
      </article>
    </main>
  );
}
