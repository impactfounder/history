import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **사건을 가리키는 주소(`?e=`)의 계약.**
 *
 * 열린 사건은 순수 로컬 상태여서 새로고침·공유에서 사라졌다 — "이걸 봐"라고 말할 방법이
 * 없었다. `?e=`가 들어오면 그리드는 **상세 파일 하나만** 받아 보고 어디로 갈지 정한다.
 * 그러려면 그 파일이 **열과 해**를 들고 있어야 한다.
 *
 * 열이 특히 중요하다: `?r=kr&e=<AI 열 사건>`처럼 **그 열이 꺼진 채로** 링크가 열릴 수 있고,
 * 그때 열을 켜 주지 않으면 사건이 화면에 없다 — 링크를 연 뜻이 없어진다.
 */
const root = path.join(__dirname, "../..");
const DATA = path.join(root, "public/data/v1");
const published = existsSync(path.join(DATA, "manifest.json"));
const grid = readFileSync(path.join(root, "src/components/timeline/TimelineGrid.tsx"), "utf8");

describe("URL이 사건을 싣는다", () => {
  it("주소를 쓸 때 열린 사건을 붙인다", () => {
    expect(grid).toContain("&e=${selected.ev.id}");
  });

  it("닫히면 붙이지 않는다 — 조건부다", () => {
    expect(grid).toMatch(/selected \? `&e=\$\{selected\.ev\.id\}` : ""/);
  });

  /** 주소가 바뀌어도 효과가 다시 돌지 않으면 닫은 뒤에도 `&e=`가 남는다. */
  it("URL 왕복이 selected를 의존성으로 본다", () => {
    expect(grid).toContain("[scrollTop, axis, cols, locale, selected]");
  });

  /**
   * 아무 문자열이나 받아 fetch하면 안 된다 — 주소는 남이 준다.
   * 발행 id의 모양(`ev_` + 12자리 16진)만 받는다.
   */
  it("id 모양을 검사한 뒤에만 쓴다", () => {
    expect(grid).toContain("/^ev_[0-9a-f]{12}$/");
  });

  it("그 열이 꺼져 있으면 켠다", () => {
    // 상세의 r을 보고 cols에 더한다
    expect(grid).toMatch(/if \(d\.r\) setCols/);
  });
});

describe.skipIf(!published)("상세 파일이 딥링크에 필요한 것을 들고 있다", () => {
  const dir = path.join(DATA, "events/detail");
  const files = readdirSync(dir);

  it("상세가 충분히 있다", () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  /**
   * **고르게 뽑은 표본**으로 본다 — 11,365개를 다 읽으면 이 테스트 하나가 11초를 쓴다
   * (처음에 그렇게 썼다가 5초 상한에 걸렸다). 전수는 발행 때 한 번 보면 되고, 여기서 막을 것은
   * "어느 날 `r`을 안 싣게 되는 것"이라 표본으로 충분하다.
   */
  const sample = files.filter((_, i) => i % Math.ceil(files.length / 400) === 0);

  it("표본이 고르게 잡혔다", () => {
    expect(sample.length).toBeGreaterThan(300);
  });

  it("상세가 열(r)과 해(year)를 싣는다", () => {
    const bad: string[] = [];
    for (const f of sample) {
      const j = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      if (!j.r || typeof j.year !== "number") bad.push(f);
      if (bad.length > 3) break;
    }
    expect(bad, "이 상세들로는 ?e= 가 어디로 갈지 알 수 없다").toEqual([]);
  });

  it("열은 실제 열 id다", () => {
    const regions = new Set(
      (JSON.parse(readFileSync(path.join(DATA, "regions.json"), "utf8")).regions as { id: string }[]).map((r) => r.id),
    );
    for (const f of files.slice(0, 300)) {
      const j = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      expect(regions.has(j.r), `${f}: r=${j.r}`).toBe(true);
    }
  });

  /**
   * 검색 결과의 id로 상세 파일에 닿을 수 있어야 한다 — 검색에서 고르면 같은 길을 탄다.
   * 색인은 `ev_` 접두를 떼고 싣는다.
   */
  it("검색 색인의 id가 상세 파일과 맞는다", () => {
    const items = JSON.parse(readFileSync(path.join(DATA, "search.json"), "utf8")).items as [string, number, string, string, number][];
    for (const it of items.slice(0, 200)) {
      expect(existsSync(path.join(dir, `ev_${it[3]}.json`)), `${it[0]} (${it[3]})`).toBe(true);
    }
  });

  it("색인의 열·해가 상세와 같다", () => {
    const items = JSON.parse(readFileSync(path.join(DATA, "search.json"), "utf8")).items as [string, number, string, string, number][];
    for (const it of items.slice(0, 120)) {
      const j = JSON.parse(readFileSync(path.join(dir, `ev_${it[3]}.json`), "utf8"));
      expect(j.r, it[0]).toBe(it[2]);
      expect(j.year, it[0]).toBe(it[1]);
    }
  });
});
