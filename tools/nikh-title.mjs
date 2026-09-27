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
  /*
    2-보강(2026-09-27). 두 빈틈이 반쪽 제목을 남겼다:
    - 원문에 **마침표가 아예 없는** 줄(「삼강군(三江郡)에서 ≪총통식≫ 간행≪신기비결≫」) — 이을 문장 끝이 없었다.
      그때는 첫 책 이름이 닫힌 뒤 **다음 겹꺾쇠(출전) 직전까지** 잇는다.
    - 연도 가드가 본문의 연도까지 출전으로 봤다(「1455년 … ≪소자진서≫와 1459년 큰 활자로 …」). 출전 꼴만 막는다:
      쪽수 · ＜＞ · 「, 1999」처럼 쉼표 뒤 네 자리 연도.
    괄호 앞의 쉼표는 15자 이상 문장이면 허용한다(「…서로 다르니, 그 값을 ≪속육전≫의 …」) — 짧은 「저자, ≪책≫」은 여전히 막힌다.
    **둘 다 괄호 앞이 조사·관형형으로 끝나 문장이 이어질 때만**(「…에서」「…가」「…을」「…한」「…된」) — 괄호 앞이 이미
    끝난 문장(「…실패함」)이면 첫 괄호가 곧 출전이라, 처음 판은 「≪고려사절요≫, 명종 2년 6월」을 제목에 붙였다.
  */
  const head = s0.slice(0, b);
  const CITE = /쪽|[＜<]|[,，]\s*\d{4}/;
  const h = head.trim();
  const cont = /(에서|에게|께서|이|가|을|를|은|는|인|한|된|던|의|와|과|로|으로|및)$/.test(h) && !/(건의|회의|논의|합의|결의|협의|심의|제의|동의)$/.test(h);
  // 원래 규칙(괄호 앞에 쉼표도 문장 끝도 없다)은 그대로, 쉼표가 든 긴 머리는 문장이 이어질 때만
  if ((!/[.,，]/.test(head) || (cont && !/[.。]/.test(head) && h.length >= 15))) {
    const after = ends.find((x) => x > b);
    if (after != null && !CITE.test(s0.slice(b, after))) return norm(s0.slice(0, after + 1).trim());
    if (after == null && cont) {
      const close = s0.slice(b).search(/[≫》〉]/);
      if (close >= 0) {
        const from = b + close + 1;
        const nb = s0.slice(from).search(/[≪《〈]/);
        const end = nb < 0 ? s0.length : from + nb;
        if (end - b <= 80 && !CITE.test(s0.slice(b, end))) return norm(s0.slice(0, end).trim());
      }
    }
  }
  return cut();
};
