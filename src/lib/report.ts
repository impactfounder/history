import { REPORT_EMAIL } from "@/lib/site";

/** 메일 본문에 싣는 원문의 상한 — 링크 전체가 길어지면 일부 메일 앱이 본문을 버린다. */
export const REPORT_TEXT_MAX = 300;

/**
 * 오류 신고 메일 링크. 제목·본문을 미리 채워 **사건 id가 반드시 따라오게** 한다 — 신고를 받는 쪽이
 * 어느 줄인지 찾아 헤매지 않게.
 *
 * `encodeURIComponent`를 쓴다. `URLSearchParams`는 공백을 `+`로 바꾸는데 mailto에서는 그 `+`가 글자 그대로
 * 보이는 메일 앱이 있다(RFC 6068은 `%20`을 쓴다).
 */
export function reportMailto(subject: string, body: string): string {
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** 원문을 상한에서 자른다. 잘랐으면 말줄임표를 붙인다. */
export const clipForReport = (s: string): string => (s.length > REPORT_TEXT_MAX ? `${s.slice(0, REPORT_TEXT_MAX)}…` : s);
