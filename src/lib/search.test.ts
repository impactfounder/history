import { afterEach, describe, expect, it, vi } from "vitest";

import { asYear, loadSearchIndex, normalize, resetSearchIndex, search, type SearchItem } from "./search";

/**
 * 검색 규칙. 틀려도 **아무것도 깨지지 않고** 결과만 이상해지는 종류라 테스트가 유일한 방어다.
 */
const it_ = (name: string, year: number, region: SearchItem[2], id: string, imp = 3): SearchItem =>
  [name, year, region, id, imp] as const;

const SAMPLE: SearchItem[] = [
  it_("임진왜란", 1592, "kr", "aaa1", 5),
  it_("부산진 전투", 1592, "kr", "aaa2", 4),
  it_("6.25 전쟁", 1950, "kr", "aaa3", 5),
  it_("베트남 전쟁", 1964, "kr", "aaa4", 4),
  it_("전쟁기념관 개관", 1994, "kr", "aaa5", 2),
  it_("ChatGPT 출시", 2022, "ai", "bbb1", 5),
  it_("대한민국 정부 수립", 1948, "kr", "ccc1", 5),
];

describe("normalize — 띄어쓰기와 대소문자를 접는다", () => {
  it.each([
    ["3·1 운동", "3·1운동"],
    ["6.25 전쟁", "6.25전쟁"],
    ["ChatGPT", "chatgpt"],
    ["  앞뒤 공백  ", "앞뒤공백"],
  ])("%s → %s", (a, b) => {
    expect(normalize(a)).toBe(b);
  });

  /** 원천마다 띄어쓰기가 다르다. 사람은 그 차이를 모르고 친다. */
  it("띄어쓰기가 달라도 같은 것을 찾는다", () => {
    expect(search(SAMPLE, "6.25전쟁")[0]?.name).toBe("6.25 전쟁");
    expect(search(SAMPLE, "6.25 전쟁")[0]?.name).toBe("6.25 전쟁");
  });
});

describe("search — 무엇이 위로 오는가", () => {
  it("이름 전체가 같으면 맨 앞", () => {
    expect(search(SAMPLE, "임진왜란")[0]?.name).toBe("임진왜란");
  });

  /**
   * 「전쟁」은 셋이 맞는다. 중요도가 없으면 순서가 무작위로 보인다 —
   * 「전쟁기념관 개관」(imp 2)이 「6.25 전쟁」(imp 5)보다 앞서면 검색이 못 쓴다.
   */
  it("여러 건이 맞으면 중요도 순", () => {
    const got = search(SAMPLE, "전쟁").map((h) => h.name);
    expect(got).toEqual(["6.25 전쟁", "베트남 전쟁", "전쟁기념관 개관"]);
  });

  it("같은 중요도면 이른 해가 먼저", () => {
    const got = search([it_("가 사건", 1900, "kr", "x1", 3), it_("나 사건", 1800, "kr", "x2", 3)], "사건");
    expect(got.map((h) => h.year)).toEqual([1800, 1900]);
  });

  it("영문도 대소문자 없이 찾는다", () => {
    expect(search(SAMPLE, "chatgpt")[0]?.id).toBe("ev_bbb1");
  });

  it("id는 접두를 되붙여 돌려준다 — 격자가 쓰는 모양", () => {
    expect(search(SAMPLE, "임진왜란")[0]?.id).toBe("ev_aaa1");
  });

  it("빈 질의는 빈 결과", () => {
    for (const q of ["", "   ", "\t"]) expect(search(SAMPLE, q)).toEqual([]);
  });

  it("안 맞으면 빈 결과", () => {
    expect(search(SAMPLE, "존재하지않는사건")).toEqual([]);
  });

  it("limit을 넘지 않는다", () => {
    const many = Array.from({ length: 100 }, (_, i) => it_(`사건 ${i}`, 1000 + i, "kr", `z${i}`));
    expect(search(many, "사건", 10)).toHaveLength(10);
  });

  /** 한 글자 질의로 1만 건을 정렬하지 않는다 — 결과는 내되 훑는 양에 상한을 둔다. */
  it("아주 흔한 질의에도 돌아온다", () => {
    const many = Array.from({ length: 9000 }, (_, i) => it_(`사건 ${i}`, 1000 + (i % 900), "kr", `z${i}`));
    const got = search(many, "사");
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(40);
  });
});

describe("asYear — 연도로 바로 가기", () => {
  const END = 2026;
  it.each([
    ["1592", 1592],
    ["2026", 2026],
    ["-100", -100],
    ["기원전 57", -56], // 기원전 57년 = 서기 -56 (0년이 없다)
    ["BC 57", -56],
  ])("%s → %s", (q, y) => {
    expect(asYear(q, END)).toBe(y);
  });

  it("축 밖은 받지 않는다 — 갈 화면이 없다", () => {
    expect(asYear("2100", END)).toBeNull();
    expect(asYear("-9999", END)).toBeNull();
    expect(asYear("기원전 3000", END)).toBeNull();
  });

  it("연도가 아니면 null — 이름 검색으로 넘어간다", () => {
    for (const q of ["임진왜란", "", "19x2", "1592년"]) expect(asYear(q, END)).toBeNull();
  });
});

describe("loadSearchIndex — 한 번만 받는다", () => {
  afterEach(() => {
    resetSearchIndex();
    vi.unstubAllGlobals();
  });

  it("두 번 불러도 요청은 한 번", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ items: SAMPLE })));
    vi.stubGlobal("fetch", f);
    const [a, b] = await Promise.all([loadSearchIndex("/x.json"), loadSearchIndex("/x.json")]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(SAMPLE.length);
    expect(b).toBe(a);
  });

  /** 한 번 실패했다고 검색이 영영 죽으면 안 된다. */
  it("실패하면 다음 시도를 막지 않는다", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: SAMPLE })));
    vi.stubGlobal("fetch", f);
    await expect(loadSearchIndex("/x.json")).rejects.toThrow();
    await expect(loadSearchIndex("/x.json")).resolves.toHaveLength(SAMPLE.length);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("items가 없어도 던지지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}))));
    await expect(loadSearchIndex("/x.json")).resolves.toEqual([]);
  });
});

/**
 * 영문 별칭. 이름은 대개 한국어 지은 제목이라 `chatgpt`로 치면 0건이었다 —
 * AI 열은 영어가 모국어인 열이고 제품 이름이 거기서 나온다.
 *
 * 별칭은 **연결된 위키데이터 항목의 영문 표제어**라 사건 이름이 아닐 때가 많다
 * (「삼단논법 서술」의 별칭은 `Aristotle`). 그래도 찾는 데는 쓸모가 있어 그대로 둔다 —
 * 실측에서 `sejong` → 「세종」, `imjin` → 「설마리 전투」가 그 덕에 걸린다.
 */
describe("영문 별칭으로도 찾는다", () => {
  const withAlias: SearchItem[] = [
    ["챗GPT 출시", 2022, "ai", "b1", 5, "ChatGPT"],
    ["설마리 전투", 1951, "kr", "b2", 4, "Battle of the Imjin River"],
    ["한글 반포", 1446, "kr", "b3", 5],
  ];

  it("이름에 없는 글자를 별칭에서 찾는다", () => {
    expect(search(withAlias, "chatgpt")[0]?.name).toBe("챗GPT 출시");
    expect(search(withAlias, "imjin")[0]?.name).toBe("설마리 전투");
  });

  it("별칭으로 맞아도 화면에 보이는 것은 이름이다", () => {
    const hit = search(withAlias, "ChatGPT")[0];
    expect(hit?.name).toBe("챗GPT 출시");
    expect(hit?.name).not.toContain("ChatGPT");
  });

  it("별칭이 없는 항목도 이름으로는 멀쩡히 찾힌다", () => {
    expect(search(withAlias, "한글")[0]?.id).toBe("ev_b3");
  });

  it("이름이 먼저다 — 이름에 맞으면 별칭은 보지 않는다", () => {
    const both: SearchItem[] = [
      ["전투 기록", 1000, "kr", "c1", 2, "Battle"],
      ["설마리 전투", 1951, "kr", "c2", 5, "Battle of the Imjin River"],
    ];
    expect(search(both, "전투").map((h) => h.id)).toEqual(["ev_c2", "ev_c1"]);
  });
});
