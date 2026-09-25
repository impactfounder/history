/**
 * 국사편찬위 줄의 제목 규칙. `tools/nikh-events.mjs`는 import하면 본문(읽기·쓰기)이 돌므로 규칙만 따로 뺀다 —
 * `tools/name-rules.mjs`와 같은 이유. 의존성 0, 본문에서 아무것도 실행하지 않는다. 검사: `src/lib/nikh-title.test.ts`.
 */

/** 본문 앞머리의 "(태조 26년 4월)" 같은 왕대 표기를 제목에서 뗀다 — 날짜는 date에 이미 있다. */
export const stripReign = (s) => s.replace(/^\s*\((?:[^()]|\([^()]*\))*\)\s*/, "").trim();
/**
 * 출전 표시(≪고려사≫ 오행지, 쪽수)를 제목에서만 뗀다. 본문(text)은 원문 그대로 남긴다.
 *
 * 처음 판은 **첫 겹꺾쇠에서 무조건 잘랐다.** 그런데 겹꺾쇠는 출전만이 아니라 문장 속 책 이름에도 쓰인다 —
 * 「삼군부(三軍府)에서 ≪수수도≫와 ≪진도≫를 간행함.」이 「삼군부(三軍府)에서」로 잘려 칩에 떴다. 또 출전 앞의
 * 저자(「…임진왜란 시작.이이화, ≪한국사 이야기≫」)가 제목 끝에 「이이화,」로 남았다. 2026-09-26에 두 꼴만 고친다:
 *
 *  1. 첫 겹꺾쇠 앞 조각이 「문장 끝 + 30자 이하 + 쉼표」면 저자 조각이다 → 그 문장 끝에서 자른다.
 *  2. 첫 겹꺾쇠 앞에 **문장 끝이 아예 없으면** 문장 안의 책 이름이다 → 겹꺾쇠 뒤 첫 문장 끝까지 잇는다.
 *     이을 조각에 쪽수·네 자리 연도·＜＞가 섞이면 출전을 삼킨 것이므로 잇지 않는다(「…중간함도수희, 1970 ＜…＞」).
 *
 * 나머지(이미 문장으로 끝난 줄)는 그대로 둔다 — 끝의 마침표 하나 같은 차이로 제목을 바꾸면 eventId와 이름 캐시가
 * 함께 바뀌어(키가 제목이다) 얻는 것 없이 수백 줄이 흔들린다(처음 시도가 893줄을 바꿨다).
 */
const SENT_END = /[가-힣)\]」』≫》〉]\./g;
export const titleOf = (s) => {
  const s0 = stripReign(s);
  const norm = (t) => t.replace(/\s+/g, " ").slice(0, 120);
  const cut = () => {
    const t = s0.split(/≪|《|〈/)[0].trim();
    return norm(t.length >= 6 ? t : s0);
  };
  const b = s0.search(/[≪《〈]/);
  if (b < 0) return cut();
  const ends = [...s0.matchAll(SENT_END)].map((m) => m.index + 1);
  const before = ends.filter((x) => x < b).pop();
  if (before != null && /^[^.。]{1,30}[,，]\s*$/.test(s0.slice(before + 1, b))) return norm(s0.slice(0, before + 1).trim());
  if (!/[.,，]/.test(s0.slice(0, b))) {
    const after = ends.find((x) => x > b);
    if (after != null && !/쪽|\d{4}|[＜<]/.test(s0.slice(b, after))) return norm(s0.slice(0, after + 1).trim());
  }
  return cut();
};
