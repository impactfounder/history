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

export const SITE_NAME = "AI & Human History";
export const SITE_DESCRIPTION = "AI의 역사와 한국·중국·일본·미국의 역사를 같은 연도 축 위에 나란히 놓는다. 그 해, 그 열에 무슨 일이 있었나.";

/**
 * 오류 신고를 받는 주소(대표 지정 2026-09-25). 이전에는 신고가 GitHub 이슈뿐이었는데, 1차 타깃(학생·교사·
 * 역사 콘텐츠 소비자, PRD §2) 대부분은 GitHub 계정이 없다 — 틀린 것을 봐도 알려 줄 길이 없었다.
 * 상세 패널의 「오류 신고」와 출처 페이지가 이 한 곳을 쓴다. 공개 페이지에 그대로 나가는 주소다.
 */
export const REPORT_EMAIL = "nyspirit@mensakorea.org";
