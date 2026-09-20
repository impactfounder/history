import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import type { RegionId } from "@/lib/i18n";

/**
 * **이름으로 찾기.** 11,393건을 쌓아 두고도 이름으로 닿을 길이 없었다 — 앱 안 검색은
 * PRD §5-10 상단바 도해(🔍)에 있는데 구현이 없었다. 격자가 한 번에 그리는 것은 **546노드**이고
 * 나머지는 줌·스크롤로 찾아가야 했다.
 *
 * ── 색인을 첫 화면에 얹지 않는다 ────────────────────────────────────────────
 * `search.json`은 10,332항목 · **gzip 256KB**다. 착지 데이터가 이미 예산(50KB)의 다섯 배라
 * (`docs/status.md` 「성능 예산 실측 C-9」) 여기에 더 얹으면 안 된다.
 * **검색을 처음 열 때** 받고 그 뒤로는 메모리에 둔다. `data-budget.test.ts`가 그 약속을 지킨다.
 */

/**
 * `[이름, 연도, 열, id(ev_ 없음), 중요도, 영문 별칭?]` — 발행 포맷 그대로. 배열이라 색인이 작다.
 *
 * 별칭이 있는 이유: 이름은 대개 **한국어 지은 제목**이라 「챗GPT 출시」를 `chatgpt`로 치면
 * 0건이었다. AI 열은 영어가 모국어인 열이고 제품 이름이 거기서 나온다.
 */
export type SearchItem = readonly [string, number, RegionId, string, number, string?];

export interface SearchHit {
  name: string;
  year: number;
  region: RegionId;
  /** 격자가 쓰는 온전한 id. 색인은 접두를 떼고 싣는다. */
  id: string;
  imp: number;
}

/**
 * 질의와 이름을 같은 모양으로 만든다.
 *
 * **공백을 지운다** — 「3·1 운동」과 「3·1운동」, 「6.25 전쟁」과 「6.25전쟁」이 같은 것을 가리키는데
 * 원천마다 띄어쓰기가 다르다. 사람은 그 차이를 모르고 친다.
 * 대소문자도 접는다(ChatGPT / chatgpt).
 */
export const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, "");

/**
 * 질의가 연도인가. 「1592」·「기원전 57」·「-57」을 받는다.
 * 축 밖이면 `null` — 그 해로는 갈 수 없고, 보여 줄 화면도 없다.
 */
export function asYear(query: string, dataEndYear: number): number | null {
  const t = query.trim();
  const bc = /^(기원전|BC|B\.C\.)\s*(\d{1,4})$/i.exec(t);
  const n = bc ? -(Number(bc[2]) - 1) : /^-?\d{1,4}$/.test(t) ? Number(t) : NaN;
  if (!Number.isFinite(n)) return null;
  return n >= AXIS_YEAR_START && n <= dataEndYear ? n : null;
}

/**
 * 이름으로 찾는다. 1차는 **부분 문자열**까지다 — 초성 검색·오타 보정은 넣지 않았다(별건).
 *
 * 줄 세우는 순서:
 *   1) **이름 전체가 같은 것**만 먼저 올린다. 「임진왜란」을 치면 그것이 1번이어야 한다.
 *   2) **중요도.** 「전쟁」은 수백 건이 맞는다 — 이것이 없으면 결과가 무작위로 보인다.
 *   3) 맞은 자리(앞에서 시작하는 것이 가운데보다) → 이른 해 → 짧은 이름 → id.
 *      끝까지 결정적으로 간다. 같은 질의가 늘 같은 순서여야 화면이 흔들리지 않는다.
 *
 * **자리가 중요도보다 아래인 것이 중요하다.** 처음에는 반대로 썼다가 「전쟁」의 1번이
 * 「전쟁기념관 개관」(중요도 2)이 되는 것을 테스트가 잡았다 — 「6.25 전쟁」(5)을 제치고서다.
 * 앞에서 시작하는 것은 **얼마나 중요한가와 아무 상관이 없다.**
 */
export function search(items: readonly SearchItem[], query: string, limit = 40): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const hits: { it: SearchItem; exact: number; where: number }[] = [];
  for (const it of items) {
    const n = normalize(it[0]);
    let i = n.indexOf(q);
    let len = n.length;
    // 이름에 없으면 영문 별칭을 본다. 별칭으로 맞아도 **화면에 보이는 것은 이름**이다.
    if (i < 0 && it[5]) {
      const a = normalize(it[5]);
      i = a.indexOf(q);
      len = a.length;
    }
    if (i < 0) continue;
    hits.push({ it, exact: len === q.length ? 0 : 1, where: i === 0 ? 0 : 1 });
    if (hits.length > 4000) break; // 「의」 같은 한 글자 질의로 1만 건을 정렬하지 않는다
  }
  hits.sort(
    (a, b) =>
      a.exact - b.exact ||
      b.it[4] - a.it[4] ||
      a.where - b.where ||
      a.it[1] - b.it[1] ||
      a.it[0].length - b.it[0].length ||
      (a.it[3] < b.it[3] ? -1 : 1),
  );
  return hits.slice(0, limit).map(({ it }) => ({ name: it[0], year: it[1], region: it[2], id: `ev_${it[3]}`, imp: it[4] }));
}

/**
 * 색인을 **한 번만** 받는다. 두 번째 열기부터는 같은 약속을 돌려준다 — 실패했으면 다시 받는다
 * (한 번 실패했다고 검색이 영영 죽으면 안 된다).
 */
let pending: Promise<SearchItem[]> | null = null;
export function loadSearchIndex(url: string): Promise<SearchItem[]> {
  if (!pending) {
    pending = fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items?: SearchItem[] }) => j.items ?? [])
      .catch((e) => {
        pending = null; // 다음 시도를 막지 않는다
        throw e;
      });
  }
  return pending;
}

/** 테스트용 — 모듈 수준 캐시를 비운다. */
export const resetSearchIndex = (): void => {
  pending = null;
};
