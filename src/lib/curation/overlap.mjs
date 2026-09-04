// 원문 재사용 검사 — editorial-policy §1-6의 강제 장치.
//
// §1-6은 "요약문은 위키 문장을 요약·번역하지 않고 사실(연도·주체·결과)에서
// 새로 작성한다"고 정했다. CC BY-SA 파생을 피하기 위한 라이선스 원칙이다.
// 그런데 **어떻게 강제할지가 없었다.** LLM에 원문을 주고 요약을 시키면 문장
// 구조가 그대로 남고, 3,000건을 사람 눈으로만 거르면 반드시 샌다.
//
// 여기서 하는 일은 하나다: 원문과 요약문 사이에 **연속으로 겹치는 어절**이
// 몇 개인지 센다. 임계값을 넘으면 발행을 막는다.
//
// 왜 어절인가: 글자 단위 최장 공통 부분 문자열은 한국어에서 우연히 길어진다
// ("~하였다", "~이 일어났다"). 어절 단위로 세면 우연한 일치와 문장 베끼기가
// 구분된다. 반대로 형태소까지 쪼개면 조사가 달라진 베끼기를 놓친다.

/** @typedef {{ length: number, tokens: string[], sourceStart: number, summaryStart: number }} Run */

/**
 * 비교용 어절 배열. 문장부호·괄호·각주 흔적을 떼고 공백으로 나눈다.
 * 숫자와 한자는 남긴다 — 연도와 원문 병기는 겹쳐도 되는 부분이지만,
 * 그것까지 빼면 "1592년 조선을" 같은 베끼기가 안 보인다.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return String(text ?? "")
    // 각주와 괄호 병기는 **지운다**. 공백으로 바꾸면 뒤에 붙은 조사가 떨어져 나가
    // "임진왜란(壬辰倭亂)이"가 "임진왜란" + "이"로 쪼개지고, 그러면 베끼기를 놓친다.
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    // 나머지 문장부호는 어절 경계이므로 공백으로 바꾼다.
    .replace(/[.,·:;!?"'“”‘’—–\-~/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 두 어절 배열에서 가장 긴 **연속 공통 구간**을 찾는다.
 * 길이가 짧아(수백 어절) O(n·m) DP로 충분하다.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Run}
 */
export function longestCommonRun(a, b) {
  let best = { length: 0, tokens: /** @type {string[]} */ ([]), sourceStart: -1, summaryStart: -1 };
  if (!a.length || !b.length) return best;

  // prev[j] = a[i-1]에서 끝나는 공통 구간 길이
  let prev = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Uint32Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] !== b[j - 1]) continue;
      const len = prev[j - 1] + 1;
      cur[j] = len;
      if (len > best.length) {
        best = {
          length: len,
          tokens: a.slice(i - len, i),
          sourceStart: i - len,
          summaryStart: j - len,
        };
      }
    }
    prev = cur;
  }
  return best;
}

/** 연속 몇 어절부터 "베낀 것"으로 볼 것인가 **(가정, 검토 데이터로 재보정)**. */
export const MAX_RUN = 6;
/** 요약문 어절 중 원문과 겹치는 비율의 상한 **(가정)**. */
export const MAX_RATIO = 0.5;

/**
 * 요약문이 원문을 재사용했는가.
 *
 * 두 가지를 함께 본다.
 * - `run`: 가장 긴 연속 공통 어절 수. 문장을 통째로 옮긴 경우를 잡는다.
 * - `ratio`: 요약문 어절 중 원문에도 있는 것의 비율. 어절 순서만 바꿔
 *   섞어 놓은 경우를 잡는다. 고유명사가 겹치는 것은 정상이므로 상한이 높다.
 *
 * @param {string} sourceText 수집 원문(위키 문장)
 * @param {string} summaryText 새로 쓴 요약문
 * @param {{ maxRun?: number, maxRatio?: number }} [opts]
 * @returns {{ ok: boolean, run: Run, ratio: number, reasons: string[] }}
 */
export function checkOverlap(sourceText, summaryText, opts = {}) {
  const maxRun = opts.maxRun ?? MAX_RUN;
  const maxRatio = opts.maxRatio ?? MAX_RATIO;

  const src = tokenize(sourceText);
  const sum = tokenize(summaryText);
  const run = longestCommonRun(src, sum);

  const srcSet = new Set(src);
  const shared = sum.filter((t) => srcSet.has(t)).length;
  const ratio = sum.length ? shared / sum.length : 0;

  const reasons = [];
  if (run.length >= maxRun) {
    reasons.push(`연속 ${run.length}어절 일치: "${run.tokens.join(" ")}"`);
  }
  if (ratio > maxRatio) {
    reasons.push(`어절 겹침 ${(ratio * 100).toFixed(0)}% (상한 ${(maxRatio * 100).toFixed(0)}%)`);
  }
  return { ok: reasons.length === 0, run, ratio, reasons };
}
