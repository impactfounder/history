import { isEventNameAny } from "../src/lib/event-name.mjs";

/**
 * **이 줄이 가리키는 위키데이터 항목이 「사건」인가.** `derive.mjs`의 중요도 점수와
 * `publish.mjs`의 교차 사건 묶기가 **같은 판정**을 써야 해서 따로 뺐다 — 두 벌이 되면
 * 한쪽만 고쳐졌을 때 "중요도는 사건으로 보는데 교차는 아니라고 보는" 상태가 생긴다.
 *
 * 왜 필요한가: QID는 사건일 수도, **나라·인물·개념**일 수도 있다. 후자를 사건으로 세면
 *
 *  · 중요도에서 — 「불교」·「컴퓨터」·「철기 시대」가 언어판 200개를 업고 세기 레벨에 올라온다
 *    (2026-09-05에 이 판정이 들어간 이유)
 *  · 교차 사건에서 — 「고구려」 QID가 **기원전 36년 건국과 668년 멸망을 한 사건으로 묶고**,
 *    「이탈리아」가 1601년 마테오 리치와 2019년 미국을 묶는다(2026-09-21 실측: 2열 이상에
 *    걸친 QID 98개 중 **40개가 이런 것**이었다)
 */

/** 사람·나라·도시·기관·직책·지리 — 사건이 아니다. */
export const NON_EVENT_TYPES = new Set([
  "Q5", "Q6256", "Q3624078", "Q515", "Q1549591", "Q1637706", "Q486972", "Q532", "Q43229", "Q4830453", "Q484652", "Q5107",
  "Q7278", "Q3918", "Q1093829", "Q7930989", "Q23442", "Q82794", "Q56061", "Q10864048", "Q35657", "Q6465", "Q15284", "Q3024240",
  "Q41710", "Q11446", "Q4022", "Q8502", "Q34442", "Q46970", "Q3957", "Q1364",
  "Q9430", "Q165", "Q23397", "Q46831", "Q33837", "Q34763", "Q39816", "Q1970725", // 바다·호수·산맥·군도·반도·계곡·삼림 — 지리
]);

/**
 * 사건 유형(위키데이터 P31) — `tools/wikidata-events.mjs`의 화이트리스트와 같은 뜻.
 * 이름이 사건 꼴이 아니어도 유형이 사건이면 사건으로 본다.
 */
export const EVENT_TYPES = new Set([
  "Q178561", "Q188055", "Q198", "Q131569", "Q12890393", "Q124734", "Q10931", "Q7944", "Q3199915", "Q45382", "Q40231",
  "Q1656682", "Q13418847", "Q350604", "Q168247", "Q2001676", "Q3839081", "Q8065", "Q1266946", "Q464980", "Q625298",
  "Q1006311", "Q180684", "Q2223653", "Q18123741", "Q3241045", "Q1190554",
]);

/**
 * **이름이 사건 꼴이거나, P31이 사건 유형이면** 사건이다. 둘 다 아니면 아니다.
 *
 * @param {{ qid?: string, names_native?: Record<string, string> }} row 수집 행
 * @param {Record<string, { types?: string[], human?: boolean }>} facts `_qid-sitelinks.json`의 facts
 */
export function isEventLike(row, facts) {
  const f = row?.qid ? facts?.[row.qid] : undefined;
  return isEventNameAny(row?.names_native) || (f?.types ?? []).some((t) => EVENT_TYPES.has(t));
}

/** 사람·나라·기관인가 — 중요도 가중치에서 가장 세게 눌리는 쪽. */
export function isPersonOrPlace(row, facts) {
  const f = row?.qid ? facts?.[row.qid] : undefined;
  return Boolean(f?.human) || (f?.types ?? []).some((t) => NON_EVENT_TYPES.has(t));
}
