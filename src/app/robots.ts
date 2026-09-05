import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** 전부 허용. 발행 JSON(/data)은 색인할 이유가 없다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/data/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
