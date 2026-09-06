import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SourcesArticle } from "@/components/pages/SourcesArticle";
import { isLocale } from "@/lib/i18n";
import { sourcesMetadata } from "@/lib/metadata";

/** 로케일 목록은 부모 레이아웃의 generateStaticParams가 만든다 — 여기 고유의 동적 세그먼트는 없다. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return sourcesMetadata(locale);
}

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SourcesArticle locale={locale} />;
}
