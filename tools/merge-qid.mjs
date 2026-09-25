/**
 * **합칠 때 두 줄의 QID가 다르면 어느 쪽을 쓰는가**(2026-09-25, 대표 승인).
 *
 * 같은 열·같은 해에 같은 사건으로 판정된 두 줄(curation/names/clash.jsonl)이 서로 다른 위키데이터 항목을
 * 가리킬 때가 있다. 전에는 대표 줄의 QID를 늘 그대로 뒀는데, 대표 줄이 인물·나라를 가리키는 경우가 있었다:
 *
 *   「황건적의 난」  대표 QID 장각(인물)      · 사라진 쪽 황건적의 난(Q751743)
 *   「무신정변」     대표 QID 의종(인물)      · 사라진 쪽 무신정변(Q11241358)
 *   「네르친스크 조약」 대표 QID 청나라(나라) · 사라진 쪽 네르친스크 조약(Q696094)
 *
 * 그래서 상세의 「이 사건을 부르는 이름」이 장각 · Zhang Jue · 張角였다. 규칙은 하나다 — **그 QID의 표제어가
 * 줄 이름과 같은 쪽**을 쓴다. 판단이 아니라 대조다. 둘 다 같거나 둘 다 다르면 대표 쪽을 그대로 둔다
 * (그것은 tools/probe-cross.mjs가 사람 판정 목록으로 넘긴다).
 *
 * 표제어는 줄의 `names_native`(그 QID의 위키데이터 사이트링크 제목, git 안)로 본다 — 수집 산출물
 * (curation/raw, git 밖)에 기대면 CI의 결과가 로컬과 달라진다(qid-facts.test.ts 참조).
 *
 * tools/publish.mjs(발행)와 tools/probe-cross.mjs(판정 목록)가 이 한 벌을 쓴다.
 * 의존성 0.
 */

/** 이름 비교용 — 괄호 속 구분자(「서진 (오호 십육국)」), 공백, 마침표, 가운뎃점을 뗀다. */
export const normName = (s) => String(s ?? "").replace(/\s*\(.*?\)\s*/g, "").replace(/[\s.·]/g, "");

/** 이 줄의 위키데이터 표제어 중 하나라도 이름과 같은가. */
export const namesMatch = (namesNative, label) => {
  const want = normName(label);
  return want.length > 0 && Object.values(namesNative ?? {}).some((t) => normName(t) === want);
};

/**
 * @param primary 합쳐져 남는 줄
 * @param dropped 사라지는 줄
 * @param label   남는 줄의 이름(지은 제목 → 번역 → 원문 순, 발행이 화면에 쓰는 것)
 * @returns "take" — 사라지는 줄의 QID를 쓴다 · "keep" — 대표 줄의 QID를 그대로
 */
export function pickMergedQid(primary, dropped, label) {
  if (!primary.qid || !dropped.qid || primary.qid === dropped.qid) return "keep";
  const a = namesMatch(primary.names_native, label);
  const b = namesMatch(dropped.names_native, label);
  return b && !a ? "take" : "keep";
}
