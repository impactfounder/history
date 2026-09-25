import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **교차 사건** — 같은 사건을 여러 열이 각자의 이름으로 적은 것. 이 제품의 간판
 * ("같은 사건을 나라마다 다르게 부른다", PRD S3·§4-1·§5-6, **M3 완료 조건**)인데
 * 발행 데이터에 **0건**이었다 — `regions`가 늘 한 열 하드코딩이었다.
 *
 * 규칙(2026-09-21 실측으로 세움): 같은 QID · `isEventLike` 통과 · 연도 ±1 · 2열 이상.
 * 결과 **50묶음 111행**. 663년 백강 전투가 中 白江口之战 · 日 白村江の戦い · 韓 백강 전투로,
 * 1945년이 日本投降 · 日本の降伏 · Surrender of Japan으로 선다.
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const published = existsSync(path.join(DATA, "cross.json"));

describe.skipIf(!published)("교차 사건 묶음", () => {
  const groups = JSON.parse(readFileSync(path.join(DATA, "cross.json"), "utf8")).groups as Record<
    string,
    { r: string; id: string; y: number; name: string | null }[]
  >;
  const entries = Object.entries(groups);

  it("묶음이 있다 — 0이면 간판이 다시 사라진 것이다", () => {
    expect(entries.length).toBeGreaterThan(20);
  });

  it("묶음마다 열이 둘 이상이다 — 한 열짜리는 교차가 아니다", () => {
    for (const [id, rs] of entries) expect(rs.length, id).toBeGreaterThan(1);
  });

  /**
   * **열마다 한 줄만.** 같은 열에 같은 QID가 여러 줄 있는 일이 흔하다(의화단 운동은 중국 열에
   * 다섯 줄이었다). 전부 묶으면 「다른 열에서는」이 같은 나라 이름으로 도배된다.
   */
  it("한 묶음에 같은 열이 두 번 나오지 않는다", () => {
    for (const [id, rs] of entries) {
      const regions = rs.map((x) => x.r);
      expect(new Set(regions).size, `${id}: ${regions.join("+")}`).toBe(regions.length);
    }
  });

  it("연도가 ±1 안이다 — 그보다 벌어지면 같은 사건이 아니라 다른 국면이다", () => {
    for (const [id, rs] of entries) {
      const ys = rs.map((x) => x.y);
      expect(Math.max(...ys) - Math.min(...ys), id).toBeLessThanOrEqual(1);
    }
  });

  it("id가 발행 사건의 모양이다", () => {
    for (const [, rs] of entries) for (const x of rs) expect(x.id).toMatch(/^ev_[0-9a-f]{12}$/);
  });

  /** 상세가 이 이름을 그대로 보인다 — 없으면 「다른 열에서는」에 빈 줄이 선다. */
  it("대부분 이름을 가진다", () => {
    const named = entries.flatMap(([, rs]) => rs).filter((x) => x.name);
    const all = entries.flatMap(([, rs]) => rs);
    expect(named.length / all.length).toBeGreaterThan(0.9);
  });
});

describe.skipIf(!published)("묶음과 사건이 서로를 가리킨다", () => {
  const groups = JSON.parse(readFileSync(path.join(DATA, "cross.json"), "utf8")).groups as Record<
    string,
    { r: string; id: string }[]
  >;

  /** 발행 사건의 `x`가 가리키는 묶음이 실재해야 한다 — 아니면 칩에 글리프만 뜨고 패널이 빈다. */
  it("사건의 x가 모두 실재하는 묶음을 가리킨다", () => {
    const seen = new Map<string, Record<string, unknown>>();
    for (const region of readdirSync(path.join(DATA, "events"))) {
      const dir = path.join(DATA, "events", region);
      if (region === "detail" || !statSync(dir).isDirectory()) continue;
      const walk = (d: string) => {
        for (const n of readdirSync(d)) {
          const p = path.join(d, n);
          if (statSync(p).isDirectory()) walk(p);
          else if (n.endsWith(".json")) for (const ev of JSON.parse(readFileSync(p, "utf8")).events ?? []) seen.set(ev.id, ev);
        }
      };
      walk(dir);
    }
    const marked = [...seen.values()].filter((e) => e.x);
    expect(marked.length, "x가 붙은 사건이 하나도 없다").toBeGreaterThan(50);
    const missing = marked.filter((e) => !groups[e.x as string]).map((e) => e.id as string);
    expect(missing.slice(0, 5)).toEqual([]);
  });
});

/**
 * **PRD §3 S3 — 제품의 간판 시나리오가 데이터에 있는가.** "같은 전쟁이 한국 열에서는 임진왜란,
 * 일본 열에서는 文禄・慶長の役, 중국 열에서는 萬曆朝鮮之役으로" — 이 문장 그대로다.
 *
 * 2026-09-25 진단 전까지 **없었다.** 세 열 모두 1592년 줄이 있었지만 ① 한국 줄은 국사편찬위 줄과
 * 합쳐지며 위키 쪽의 임진왜란 QID(Q576338)를 버렸고 ② 일본·중국 줄은 QID가 도요토미 히데요시·
 * 조선에 붙어 있었다. ①은 합침의 QID 승계로, ②는 `curation/qid-fix.json`으로 고쳤다.
 * 묶음 수를 세는 위 검사로는 이 하나가 빠져도 통과한다 — 그래서 이름으로 따로 지킨다.
 */
describe.skipIf(!published)("S3 — 하나의 사건, 여러 이름", () => {
  const groups = Object.values(
    JSON.parse(readFileSync(path.join(DATA, "cross.json"), "utf8")).groups as Record<string, { r: string; y: number; name: string | null }[]>,
  );

  it("1592년 임진왜란이 한국·일본·중국 세 열에 각자의 이름으로 한 묶음이다", () => {
    const g = groups.find((rs) => rs.some((x) => x.r === "kr" && x.name === "임진왜란"));
    expect(g, "임진왜란이 교차 묶음에 없다").toBeDefined();
    const byRegion = Object.fromEntries(g!.map((x) => [x.r, x.name]));
    expect(byRegion).toMatchObject({ kr: "임진왜란", jp: "文禄・慶長の役", cn: "萬曆朝鮮之役" });
    for (const x of g!) expect(Math.abs(x.y - 1592), `${x.r} ${x.y}`).toBeLessThanOrEqual(1);
  });
});
