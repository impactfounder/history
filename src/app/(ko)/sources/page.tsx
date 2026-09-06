import type { Metadata } from "next";
import { SourcesArticle } from "@/components/pages/SourcesArticle";
import { sourcesMetadata } from "@/lib/metadata";

export const metadata: Metadata = sourcesMetadata("ko");

export default function SourcesPage() {
  return <SourcesArticle locale="ko" />;
}
