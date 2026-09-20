/**
 * 표시 등급(티어) 파생. 좌표 규약이 아니라 **표시 규칙**이라 axis.ts와 성격이 다르므로
 * 별도 파일로 둔다(axis.ts는 테스트 46개가 물고 있어 건드리지 않는 것이 설계 목표다).
 *
 * axis.ts와 같은 규약: 의존성 0, DOM 접근 0.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * publish.mjs가 줌 레벨별로 데이터를 미리 거른다 — 세기 청크는 imp>=5만, 십년은
 * imp>=4만. 그래서 **세기 화면에서는 모든 칩이 중요도 5**가 되고(실측: kr 91 · cn 390 ·
 * jp 114 · us 165건 전부 imp 5), 중요도 삼항이 항상 같은 가지로 떨어져 화면 안 대비가
 * 수학적으로 0이 된다. 3단 위계 중 세기는 1단, 십년은 2단만 쓰인다.
 *
 * 청크는 발행 시 이미 `imp desc → sl desc → y0 asc`로 정렬돼 있으므로 **배열 인덱스가
 * 곧 순위**다. 같은 세기 청크 안에서 sl은 14~227로 12배 퍼져 있다 — 재발행 없이
 * 인덱스만으로 레벨 안 상대 위계를 만들 수 있다.
 */

export type Tier = 1 | 2 | 3;

/**
 * 순위로 등급을 나누는 백분위 컷.
 * 검증(세기·kr): 1900행 sl `150 132 88 88 72 52 45` → 1,1,1,1,1,2,2 /
 * 1500행 `46 14 12 12 11` → 2,3,3,3,3. 오늘은 이 12개가 전부 같은 두꺼운 카드다.
 */
const RANK_CUT_LEAD = 0.12;
const RANK_CUT_MID = 0.42;

/**
 * 순위를 쓰기 위한 최소 모집단. 이보다 작은 청크는 백분위가 뜻을 잃는다
 * (3건짜리 청크에서 "상위 12%"는 언제나 1건이다). 연도 레벨의 희소 청크가 이 경우이고,
 * 거기서는 imp가 1~5로 온전하므로 base만으로 충분하다 — **오늘 화면이 그대로 유지된다.**
 */
export const RANK_MIN_N = 24;

/** 중요도만으로 정한 기본 등급. 오늘의 tone 삼항과 같은 경계다. */
export function baseTier(imp: number): Tier {
  return imp >= 5 ? 1 : imp === 4 ? 2 : 3;
}

/**
 * 표시 등급. `max(base, byRank)` — **순위는 강등만 시킨다.**
 *
 * "강등만"이 핵심 안전장치다. 고대 십년 청크에 imp 2짜리 사건 하나만 있으면 pct=0이라
 * 승격되어 두꺼운 카드가 되는데, 그건 "빈 셀은 비어 있다"(PRD §5-10)의 형제 원칙을
 * 어긴다 — 사건이 적다는 사실이 그 사건을 중요하게 만들지 않는다.
 *
 * @param imp   지역별 중요도 1~5
 * @param index 청크 안에서의 위치(0부터). 청크는 imp desc → sl desc로 정렬돼 있다.
 * @param n     청크 건수
 */
/**
 * **지금 소비자가 없다**(2026-09-20). 유일한 소비자가 기간 프레임의 자격 판정이었는데,
 * 프레임이 청크 대신 `spans.json`을 보게 되면서 `baseTier(imp)`로 옮겼다 — 청크 안 순위는
 * **줌 레벨마다 달라져서** 같은 기간이 십년 화면에서는 프레임을 갖고 연도 화면에서는 잃었다.
 * 프레임은 어느 줌에서 보든 같아야 한다.
 *
 * 지우지 않고 남긴다. 1b 설계의 "셀 안 선별 순서"(README §7-5)가 아직 이 값을 쓰지 않을 뿐이고,
 * 그때 필요한 것은 여기 있는 계산 그대로다. 테스트도 함께 남는다.
 */
export function tierOf(imp: number, index: number, n: number): Tier {
  const base = baseTier(imp);
  if (n < RANK_MIN_N) return base;
  const pct = index / n;
  const byRank: Tier = pct < RANK_CUT_LEAD ? 1 : pct < RANK_CUT_MID ? 2 : 3;
  return Math.max(base, byRank) as Tier;
}

/**
 * 기간 프레임을 그릴 최소 세로 길이(px). 두꺼운 칩(26) × 2 + 여백 8.
 *
 * **최소 높이를 주지 않는 것이 요점이다.** 이보다 짧아지면 프레임을 억지로 늘리는 대신
 * 지속이 기하 채널에서 텍스트 채널로 넘어간다(칩 라벨에 "1592–1598"). 시점 사건은 절대
 * 범위 표기를 달지 않으므로 혼동이 구조적으로 불가능하다.
 *
 * 실측: 기간 사건 152건 중 68건이 1년 이하이고 3년 초과는 63건뿐이다. 세기 축척(2px/년)에서
 * 60px는 30년이라 사실상 전부 텍스트로 떨어지는데, 세기에서 3년 전쟁은 실제로 점이므로 옳다.
 */
export const SPAN_MIN_PX = 60;
/** 동시에 겹쳐 그릴 프레임 수. 실측 최대 겹침은 13개(us 1950년대)라 상한이 반드시 필요하다. */
export const MAX_LANES = 3;

/**
 * 겹치는 기간을 레인에 배정한다. 시작 순으로 훑으며 비어 있는 가장 작은 레인을 준다.
 * 레인이 다 차면 -1 — 호출부는 그 사건의 프레임을 포기하고 텍스트 표기로 떨어뜨린다.
 * `layoutCell`의 높이 예산과 같은 편집 규칙의 폭 버전이다(들어갈 만큼만 넣고 나머지는 격을 낮춘다).
 *
 * 입력은 시작 좌표 오름차순이어야 한다. 순수 함수 — 같은 입력에 같은 출력.
 */
export function assignLanes(spans: { top: number; bottom: number }[], maxLanes = MAX_LANES): number[] {
  const laneEnd: number[] = [];
  return spans.map((s) => {
    for (let i = 0; i < laneEnd.length; i++) {
      if (laneEnd[i]! <= s.top) { laneEnd[i] = s.bottom; return i; }
    }
    if (laneEnd.length >= maxLanes) return -1;
    laneEnd.push(s.bottom);
    return laneEnd.length - 1;
  });
}
