/**
 * 연도 파싱 — 연표 한 줄의 앞머리에서 연도를 읽는다. 천문학적 연수로 돌려준다(1 BC = 0, data-model §4-4).
 *
 * `collect.mjs`에서 따로 뺀 이유: 이 함수는 **오탐 판정의 1차 관문**이라 버그가 곧 잘못된 연표가
 * 되는데(아래 주석들이 그 이력이다), collect.mjs는 import하면 CLI 본문이 돌아 테스트할 수 없었다.
 * 의존성 0.
 */

/**
 * 연도 파싱. 천문학적 연수로 돌려준다(1 BC = 0, data-model §4-4).
 * 파싱 실패는 null — 오탐 판정의 1차 관문이다.
 */
export function parseYear(text) {
  const t = text.replace(/,/g, "").trim();
  let m;
  // 기간 표현은 연도가 아니다 — "3年間弱に及ぶ民主党中心の政権が…"(3년간)이 서기 3년으로 읽혔다(2026-09-05)
  if (/^(?:約|约|およそ)?\s*\d{1,4}\s*(?:年間|年余|年余り|ヶ年|か年|年多)/.test(t)) return null;
  // 한자권(ja·zh, 2026-09-05 C-12): 前386年 / 紀元前2万年頃 / 約前1747年 / 607年 / 1159年（平治元年） / 前3世紀
  if ((m = t.match(/^(?:約|约|およそ)?\s*(紀元前|公元前|西元前|前)\s*(\d{1,2})\s*(?:世紀|世纪)/))) {
    const c = Number(m[2]);
    return { year: 1 - (c * 100 - 50), precision: "century", approximate: true, era: "bc" };
  }
  if ((m = t.match(/^(?:約|约|およそ)?\s*(\d{1,2})\s*(?:世紀|世纪)/))) {
    const c = Number(m[1]);
    return { year: (c - 1) * 100 + 50, precision: "century", approximate: true, era: "ad" };
  }
  if ((m = t.match(/^(約|约|およそ)?\s*(紀元前|公元前|西元前|前)\s*(\d+)\s*(万|萬)?\s*年?\s*(頃|ごろ|左右|前後)?/))) {
    const mult = m[4] ? 10000 : 1;
    return { year: 1 - Number(m[3]) * mult, precision: mult > 1 ? "millennium" : "year", era: "bc", ...(m[1] || m[5] ? { approximate: true } : {}) };
  }
  if ((m = t.match(/^(約|约|およそ)?\s*(\d{1,4})\s*年(?!代)\s*(頃|ごろ|左右|前後)?/))) {
    return { year: Number(m[2]), precision: "year", era: "ad", ...(m[1] || m[3] ? { approximate: true } : {}) };
  }
  // 1960年代 — 십년 단위 항목. 그대로 두면 아래 영어 규칙이 1960을 연도로 읽는다
  if ((m = t.match(/^(\d{3,4})\s*年代/))) return { year: Number(m[1]) + 5, precision: "decade", approximate: true, era: "ad" };
  // 세기 규칙이 먼저다 — 아래 BC 규칙이 "BC.4세기"의 "BC.4"를 연도 4로 먹어 버린다(파일럿 #8).
  // 세기: BC.4세기경 / 15세기 → 세기 중앙값, precision century. "BC 4세기"는 BC 400~301이므로 중앙 BC 350
  if ((m = t.match(/^(?:기원전|BC\.?)\s*(\d{1,2})\s*세기/i))) {
    const c = Number(m[1]);
    return { year: 1 - (c * 100 - 50), precision: "century", approximate: true, era: "bc" };
  }
  if ((m = t.match(/^(\d{1,2})\s*세기/))) {
    const c = Number(m[1]);
    return { year: (c - 1) * 100 + 50, precision: "century", approximate: true, era: "ad" };
  }
  // 한국어: BC.70만 / 기원전 500년 / 1592년
  if ((m = t.match(/^(?:기원전|BC\.?)\s*(\d+)\s*(만|천)?\s*년?/i))) {
    const mult = m[2] === "만" ? 10000 : m[2] === "천" ? 1000 : 1;
    return { year: 1 - Number(m[1]) * mult, precision: mult > 1 ? "millennium" : "year", era: "bc" };
  }
  if ((m = t.match(/^(\d{1,4})\s*년/))) return { year: Number(m[1]), precision: "year", era: "ad" };
  /*
    영어 서수 세기 — "3rd century BC", "1st century", "9th Century".
    아래 일반 숫자 규칙보다 **먼저** 와야 한다. 거기서는 "3rd"의 r이 를 막아 null이 되고,
    null이면 앞 행의 연도를 물려받는다 — AI 열 첫 수집에서 헤론(1세기)과 크테시비오스(기원전
    3세기)가 아리스토텔레스와 같은 기원전 383년에 놓였다(2026-09-20). 이 문서의 고대 표는
    날짜 칸이 비고 연도가 본문 앞머리에 있다.
  */
  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)\s+century\s*(BCE?)?/i))) {
    const c = Number(m[1]);
    const bc = Boolean(m[2]);
    return { year: bc ? 1 - (c * 100 - 50) : (c - 1) * 100 + 50, precision: "century", approximate: true, era: bc ? "bc" : "ad" };
  }
  // 물결 근사 — "~800", "~1500". c. 와 같은 뜻인데 이 문서는 물결을 쓴다
  if ((m = t.match(/^~\s*(\d{1,7})\s*(BCE?)?/i))) {
    const y = Number(m[1]);
    const bc = Boolean(m[2]);
    return { year: bc ? 1 - y : y, precision: "year", approximate: true, era: bc ? "bc" : "ad" };
  }
  // 영어: 300 BC / 1592 / c. 1500 / 1860–1899
  if ((m = t.match(/^c\.?\s*(\d{1,7})\s*(BCE?)?/i))) {
    const y = Number(m[1]);
    return { year: m[2] ? 1 - y : y, precision: "year", approximate: true, era: m[2] ? "bc" : "ad" };
  }
  if ((m = t.match(/^(\d{1,7})\s*(BCE?|CE|AD)?\b/i))) {
    const y = Number(m[1]);
    const bc = /^BCE?$/i.test(m[2] ?? "");
    // 한자권 줄의 맨 앞 숫자는 목록 번호일 때가 많다 — "1 大化 (645年-650年)"가 서기 1년이 됐다.
    // 한자·가나가 이어지는데 연호 표시(BC/AD)도 없으면 연도로 보지 않는다(2026-09-05)
    if (!m[2] && /^[\s.:·-]*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t.slice(m[1].length))) return null;
    return { year: bc ? 1 - y : y, precision: "year", era: bc ? "bc" : "ad" };
  }
  return null;
}

