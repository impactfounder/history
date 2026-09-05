/**
 * 사이트 기준 URL — metadataBase·sitemap·robots가 같이 쓴다.
 * 도메인은 아직 미정(PRD 부록 A-3). NEXT_PUBLIC_SITE_URL이 있으면 그것, 없으면 Vercel이 빌드 때 주는
 * 프로덕션 호스트, 둘 다 없으면 로컬.
 */
export const SITE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
})();

export const SITE_NAME = "history";
export const SITE_DESCRIPTION = "여러 나라의 역사를 같은 연도 축 위에 나란히 놓고 비교한다. 그 해, 그 나라에 무슨 일이 있었나.";
