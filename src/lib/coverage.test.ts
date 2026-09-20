import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 수록 범위 계약 — **해가 바뀌면 조용히 한 해가 빈다.** 그것을 빨간 테스트로 바꾼다.
 *
 * 수록 끝 연도가 두 곳에 있고 뜻이 다르다:
 *   tools/derive.mjs   DATA_END_YEAR = 전년도. 그 뒤의 행을 rejected로 거른다(PRD §11 C-2)
 *                      COVERAGE_TO   = 열별 예외. AI만 올해까지(data-model §2-1 coverage_to)
 *   src/lib/year-data  DATA_END_YEAR = **어느 열이든** 사건이 있는 마지막 해.
 *                      연도 페이지 생성 범위·사이트맵·「다음 해」 링크가 쓴다
 *
 * 둘이 어긋나면 증상이 조용하다 — year-data가 낮으면 상세의 「그 해 페이지」 링크가 404가 되고
 * (`dynamicParams = false`), 높으면 사건이 하나도 없는 해가 사이트맵에 올라간다.
 *
 * **오늘 날짜로 자동 계산하지 않는 이유**: 이 값은 시계가 아니라 데이터 사실이다.
 * "2025까지"는 "2025년까지 수집·검증했다"는 뜻이지 "작년이 2025다"가 아니다. 날짜로 올리면
 * 1월 1일에 상수만 올라가고 데이터는 그대로여서 빈 해가 사이트맵에 생기고, 같은 커밋을
 * 연말과 연초에 빌드했을 때 산출물이 달라진다(이 레포는 curation/*.jsonl을 추적해 결정적으로
 * 발행한다). 새 해를 넣으려면 어차피 collect.mjs부터 다시 돌려야 한다.
 *
 * 그래서 사람이 올리되, **올리는 것을 잊으면 여기서 걸린다.**
 */
const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");
const derive = read("tools/derive.mjs");
const yearData = read("src/lib/year-data.ts");
const axis = read("src/lib/timeline/axis.ts");

/** 소스를 글자로 읽는다 — derive.mjs는 import하면 CLI 본문이 돈다(parse-year.mjs를 뺀 이유와 같다). */
function num(src: string, pattern: RegExp, what: string): number {
  const m = pattern.exec(src);
  if (!m) throw new Error(`${what}를 찾지 못했다 — 이름이 바뀌었으면 이 테스트도 같이 고쳐라`);
  return Number(m[1]);
}

const DERIVE_END = num(derive, /DATA_END_YEAR = (\d{4})/, "derive.mjs DATA_END_YEAR");
const PAGE_END = num(yearData, /DATA_END_YEAR = (\d{4})/, "year-data.ts DATA_END_YEAR");
/** 열별 예외. 지금은 ai 하나뿐이지만 표로 읽는다 — 늘어나도 이 테스트가 따라간다. */
const COVERAGE_TO: Record<string, number> = Object.fromEntries(
  [...(/const COVERAGE_TO = \{([^}]*)\}/.exec(derive)?.[1] ?? "").matchAll(/(\w+):\s*(\d{4})/g)]
    .map((m) => [m[1]!, Number(m[2])]),
);

const THIS_YEAR = new Date().getFullYear();
/**
 * 아래 "낡지 않았다" 두 개만 **배포에서는 건너뛴다.**
 *
 * `prebuild`가 vitest를 물고 있어 나머지 계약 테스트는 배포를 막는다(tsc가 이미 그렇듯이).
 * 하지만 이 둘은 시계에 달려 있어서, 그대로 두면 **1월 1일에 배포가 통째로 잠긴다** —
 * 그날 급한 수정이 있어도 한 해 치 수집을 끝내기 전에는 아무것도 못 올린다.
 * 이 둘이 잡는 것(한 해 밀림)은 며칠 늦어도 되는 일이라 그 대가가 맞지 않는다.
 *
 * 로컬 `npm test`와 (붙인다면) CI에서는 그대로 돈다 — 잔소리가 필요한 곳은 거기다.
 */
const onVercel = process.env.VERCEL === "1";

describe("수록 끝 — 두 상수가 어긋나지 않는다", () => {
  it("열별 예외를 하나 이상 읽었다 — 정규식이 헛돌면 아래 검사가 전부 무의미해진다", () => {
    expect(Object.keys(COVERAGE_TO).length).toBeGreaterThan(0);
  });

  it("페이지 범위는 모든 열의 끝 중 가장 큰 값이다", () => {
    const last = Math.max(DERIVE_END, ...Object.values(COVERAGE_TO));
    expect(PAGE_END).toBe(last);
  });

  it("열별 예외는 기본 끝보다 앞설 수 없다 — 그러면 예외가 아니라 축소다", () => {
    for (const [region, y] of Object.entries(COVERAGE_TO)) {
      expect(y, `${region}`).toBeGreaterThanOrEqual(DERIVE_END);
    }
  });
});

describe("축의 시작 — derive.mjs가 axis.ts의 사본을 들고 있다", () => {
  /**
   * `.mjs`는 `.ts`를 import하지 못해 값이 두 벌이다. 어긋나면 **축 밖 사건이 발행된다** —
   * 격자도 `/y/{year}`도 축 안만 그리므로 그 사건은 파일로만 존재하고 아무도 볼 수 없다.
   * 실제로 173건이 그렇게 나가고 있었고 배지의 사건 수만 부풀어 있었다(2026-09-20).
   */
  it("두 값이 같다", () => {
    const fromAxis = num(axis, /AXIS_YEAR_START = (-?\d+)/, "axis.ts AXIS_YEAR_START");
    const fromDerive = num(derive, /AXIS_START = (-?\d+)/, "derive.mjs AXIS_START");
    expect(fromDerive).toBe(fromAxis);
  });
});

describe("수록이 낡지 않았다", () => {
  /**
   * 해가 바뀌면 여기가 빨개진다. 고치는 법은 상수를 올리는 것이 **아니라** 파이프라인을
   * 다시 도는 것이다: collect → enrich → summaries → derive → translate → name → dedupe → publish.
   * 그다음에 이 두 상수를 올린다. 순서를 뒤집으면 비어 있는 해가 사이트맵에 올라간다.
   */
  it.skipIf(onVercel)(`기본 열이 전년도(${THIS_YEAR - 1})까지 수록돼 있다`, () => {
    expect(
      DERIVE_END,
      `수집이 한 해 밀렸다. tools/collect.mjs부터 다시 돌리고 derive.mjs의 DATA_END_YEAR를 올려라.`,
    ).toBeGreaterThanOrEqual(THIS_YEAR - 1);
  });

  it.skipIf(onVercel)(`AI 열은 올해(${THIS_YEAR})까지 수록돼 있다 — 이 열만 올해를 싣는다`, () => {
    expect(
      COVERAGE_TO.ai,
      `AI 열이 낡았다. "AI & Human History"에서 AI 열이 뒤처지면 제품이 낡아 보인다.`,
    ).toBeGreaterThanOrEqual(THIS_YEAR);
  });
});
