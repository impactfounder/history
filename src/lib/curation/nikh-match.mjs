/**
 * 위키 연표 행 ↔ 국사편찬위원회 연표 항목 매칭 — data-model §4-2 [파생], A-16 하이브리드.
 *
 * 위키백과 한 줄이 "무슨 일"을 고르고, 같은 해의 국사편찬위 항목 중 그 일을 가리키는
 * 것을 찾는다. 찾으면 그 항목이 공식 출처·정확한 날짜·상세 본문이 된다.
 *
 * 신호는 셋이고 하나라도 강하면 받는다:
 *   강함  ko 표제어(사이트링크)가 국사편찬위 본문에 있다 / 세그먼트 전체가 본문에 통째로 들어 있다
 *   중간  한글 핵심어(조사·서술어 뗀 3자 이상 어절)가 본문에 있고, 문자 2-gram Dice가 낮지 않다
 *   약함  2-gram Dice만 높다
 * 순위는 신호 합 + 날짜 일치 보너스(월·일 같으면 +1) + 일반 연표 보너스. 날짜 보너스가 없으면
 * "KBS 이산가족찾기 생방송 **시작**(6월 30일)"이 같은 해 11월 "마감" 항목에 붙는다.
 *
 * 한국사 연표(ko) 표 행은 한 줄에 여러 사건이 쉼표로 묶여 있어("조미수호조규 체결, 임오군란
 * 일어남, …") 세그먼트로 나눠 각각 매칭한다 — 한 행이 공식 항목 여러 개를 가질 수 있다.
 * 영어 행은 한글 핵심어가 없으니 ko 표제어와 날짜로만 잡는다.
 *
 * 의존성 0. 파일·네트워크 없음. 테스트: nikh-match.test.ts
 */

/**
 * 국사편찬위 연표 한 항목(tools/fetch-nikh.mjs 출력).
 * @typedef {{ id: string, db: string, series?: string | null, title: string, text: string,
 *   date: { y: number, m?: number, d?: number, cal?: string, leap?: boolean }, level?: number | null, url?: string | null }} NikhEntry
 */

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const MONTH_RE = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i;
const KO_DATE_RE = /(\d{1,2})월\s*(\d{1,2})일|(\d{1,2})월/;

/** 괄호 속 한자 풀이·출전 표시·구두점·공백을 걷어낸 비교용 문자열. */
export const norm = (s) =>
  s
    .replace(/\([^)]*\)|（[^）]*）|≪[^≫]*≫|《[^》]*》|〈[^〉]*〉/g, "")
    .replace(/[\s·,.。:;'"`\-–—~〜?!「」『』]/g, "")
    .toLowerCase();

/**
 * 행 앞머리의 연도 표기를 뗀다 — "1882년 ", "BC.238년경 ", "1882: ", 그리고 한자권
 * "前386年：", "約前1747年：", "紀元前2万年頃 ", "1600年（慶長5年） "(원호 괄호까지), "1960年代 ".
 */
export const stripYear = (t) =>
  t
    .replace(
      // 원호 괄호는 한 겹 중첩까지 — "1543年（天文12年、一説に1542年（天文11年））"
      /^\s*(?:約|约|およそ)?\s*(?:BC\.?\s*|기원전\s*|紀元前|公元前|西元前|前)?\d+\s*(?:만|万|萬)?\s*(?:年代?|년)?\s*(?:경|말|초|쯤|중반|후반|전반|頃|ごろ|左右|前後)?\s*(?:（(?:[^（）]|（[^（）]*）)*）)?\s*[:：\-–—]?\s*/,
      "",
    )
    .replace(/^\d{1,4}:\s*/, "")
    .trim();

/** 행 안의 월·일. ko "6월 30일" / en "15 August", "August 15". 없으면 {}. */
export function parseWikiDate(text) {
  const ko = KO_DATE_RE.exec(text);
  if (ko) return ko[1] ? { m: Number(ko[1]), d: Number(ko[2]) } : { m: Number(ko[3]) };
  const en = MONTH_RE.exec(text);
  if (en) return en[2] ? { m: MONTHS[en[2].toLowerCase()], d: Number(en[1]) } : { m: MONTHS[en[3].toLowerCase()], d: Number(en[4]) };
  return {};
}

/** 날짜 표기를 뗀 본문. 세그먼트 비교에 날짜 숫자가 섞이지 않게 한다. */
const stripDate = (t) => t.replace(KO_DATE_RE, "").replace(MONTH_RE, "").replace(/^[\s.,:]+/, "");

/** 한 행을 사건 세그먼트로. ko 표 행만 쉼표·대시로 나눈다. */
export function segments(text, { split }) {
  const body = stripDate(stripYear(text));
  const parts = split ? body.split(/,\s+|\s+[—–]\s+|;\s*/) : [body];
  return parts.map((p) => p.trim()).filter((p) => norm(p).length >= 2);
}

/** 조사·흔한 서술어. 어절 끝에서 최대 두 번 뗀다. */
const STOP =
  /(체결|일어남|발생|설립|즉위|건국|시작|창건|개시|반포|공포|선포|실시|사망|서거|출생|제정|창설|편찬|간행|완성|시행|폐지|성립|멸망|점령|침입|침략|승리|패배|봉기|개최|출범|취임|사퇴|당선|발표|채택|가입|수립|통일|해체|결성|조직|이전|개통|준공|착공|개교|창간|귀국|파견|임명|처형|살해|피살|암살|승하|붕어|타계|되다|하다|한다|함|됨|됐다|했다|이|가|을|를|은|는|의|에|에서|으로|로|와|과|도|에게|부터|까지)$/;

/**
 * 나라·기관처럼 어느 항목에나 나오는 말. 핵심어로 치지 않는다 — "대한민국 헌법 공포"가
 * "대한민국 건국"에, "대한제국 수립"이 "일본정부, 대한제국 국호 승인"에 붙는 것을 막는다.
 */
const GENERIC = new Set([
  "대한민국", "대한제국", "대통령", "정부", "국회", "한국", "조선", "신라", "백제", "고구려", "고려", "발해", "가야",
  "일본", "중국", "미국", "소련", "러시아", "당나라", "명나라", "청나라", "북한", "남한", "국민", "사회", "서울", "평양",
  "임시정부", "총독부", "조선총독부", "일제",
]);

/** 한글 핵심어 — 3자 이상, 한글 포함, 일반어 제외. */
export function keyTerms(seg) {
  return seg
    .split(/\s+/)
    .map((w) => w.replace(/[(),.:;'"~]/g, ""))
    .map((w) => { let x = w; for (let k = 0; k < 2; k++) x = x.replace(STOP, ""); return x; })
    .filter((w) => w.length >= 3 && /[가-힣]/.test(w) && !GENERIC.has(w));
}

/** 괄호·출전만 걷고 공백은 남긴 본문 — 어절 경계 확인용. */
const light = (s) => s.replace(/\([^)]*\)|（[^）]*）|≪[^≫]*≫|《[^》]*》|〈[^〉]*〉/g, "").replace(/[·,.。:;'"`\-–—~〜?!「」『』]/g, " ").toLowerCase();

/**
 * 용어가 본문에 **어절 첫머리로** 나오는가. "지세령"이 "시가지세령" 안에서 잡히면 안 된다 —
 * 앞 글자가 한글이면 다른 낱말의 일부다. 뒤는 조사가 붙으니 보지 않는다.
 */
export function hasTerm(hayLight, term) {
  const t = term.replace(/\s+/g, "");
  if (!t) return false;
  // 글자 사이 공백은 허용("이산가족 찾기" ↔ "이산가족찾기"), 앞 글자가 한글이면 불가
  const body = t.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  return new RegExp("(?<![가-힣])" + body).test(hayLight);
}

const grams = (s) => { const g = new Set(); const t = norm(s); for (let i = 0; i + 2 <= t.length; i++) g.add(t.slice(i, i + 2)); return g; };
export function dice(a, b) {
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size);
}

const GENERAL = new Set(["고대사연표", "근대사연표", "대한민국사연표"]);

/**
 * 세그먼트 하나를 국사편찬위 항목 하나에 대본다.
 * @param {string} seg
 * @param {string | null | undefined} koName
 * @param {{ m?: number, d?: number }} wikiDate
 * @param {NikhEntry} n
 * @returns {{accept:boolean, rank:number, why:string[]}}
 */
export function scoreMatch(seg, koName, wikiDate, n) {
  const raw = n.title + " " + n.text;
  const hay = norm(raw);
  const hayL = light(raw);
  const why = [];
  let strong = false;
  const kn = koName?.replace(/\s*\([^)]*\)\s*$/, "").trim(); // "장조 (조선)" → "장조"
  let occ = 0;
  if (kn && kn.length >= 2 && !GENERIC.has(kn) && hasTerm(hayL, kn)) {
    strong = true;
    why.push(`표제어:${kn}`);
    // 같은 표제어를 가진 항목이 한 해에 여럿이면(임오군란 1882년에 12건) "발생" 쪽이 "관하여·구실로·주모자 처형" 쪽보다 그 사건이다
    occ = occurrence(hayL, kn);
    if (occ) why.push(`용례${occ > 0 ? "+" : ""}${occ}`);
  }
  const ns = norm(seg);
  if (ns.length >= 4 && hay.includes(ns)) { strong = true; why.push("통째"); }
  const hits = keyTerms(seg).filter((k) => hasTerm(hayL, k));
  if (hits.length) why.push(`핵심어:${hits.join("|")}`);
  const d = Math.max(dice(seg, n.title), dice(seg, n.text));
  let date = 0;
  if (wikiDate.m && n.date.m === wikiDate.m) date = wikiDate.d && n.date.d === wikiDate.d ? 1 : 0.3;
  if (date) why.push(`날짜+${date}`);
  // 같은 날짜 + 약간의 글자 겹침도 받는다 — "7월 17일 헌법 공포" ↔ "제헌헌법 공포·시행"(핵심어 2자라 못 잡는다)
  const accept = strong || (hits.length >= 1 && d >= 0.25) || d >= 0.45 || (date === 1 && d >= 0.2);
  // 동점이면 짧은 항목(초점이 좁다)을 앞세운다
  const tie = -Math.min(n.text.length, 300) / 10000;
  const rank = (strong ? 1 : 0) + 0.5 * Math.min(hits.length, 3) + d + date + occ + (GENERAL.has(n.db) ? 0.2 : 0) + tie;
  return { accept, rank, why };
}

const OCCUR = "(발생|일으킴|일으켜|일어남|일어나|발발|봉기|시작|체결|조인|공포|반포|즉위|건국|수립|창립|설립|선포|개시|성립|출범|발족|개통|준공|창간|개교)";
const AFTERMATH = "(에\\s*관하여|에\\s*관한|관련|이후|후의|기념|추도|구실|혐의|주모자|여파|관여|영향)";
/** 표제어 뒤에 "발생·일으킴…"이 오면 그 사건 자체(+0.5), "관하여·구실로·주모자…"면 후일담(−0.3). */
export function occurrence(hayLight, term) {
  const t = term.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  if (new RegExp(t + "\\s*(을|를|이|가|은|는)?\\s*" + OCCUR).test(hayLight)) return 0.5;
  if (new RegExp(t + "\\s*" + AFTERMATH).test(hayLight)) return -0.3;
  return 0;
}

/**
 * 위키 행 하나에 대해 후보(같은 해 국사편찬위 항목) 중 세그먼트별 최선을 고른다.
 * @param {{text:string, koName?:string|null, split:boolean}} row
 * @param {NikhEntry[]} cands  같은 해 항목들
 * @returns {Array<{n:NikhEntry, seg:string, rank:number, why:string[]}>}  항목 중복 제거, 최대 4개
 */
export function bestMatches(row, cands, { max = 4 } = {}) {
  if (!cands.length) return [];
  const wikiDate = parseWikiDate(row.text);
  /** @type {Array<{n:NikhEntry, seg:string, rank:number, why:string[]}>} */
  const out = [];
  for (const seg of segments(row.text, { split: row.split })) {
    let best = null;
    for (const n of cands) {
      const s = scoreMatch(seg, row.koName, wikiDate, n);
      if (s.accept && (!best || s.rank > best.rank)) best = { n, seg, rank: s.rank, why: s.why };
    }
    if (best && !out.some((o) => o.n.id === best.n.id)) out.push(best);
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, max);
}
