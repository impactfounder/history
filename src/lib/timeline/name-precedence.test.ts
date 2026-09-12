import { describe, expect, it } from "vitest";

import { eventLabel, type LabelSource } from "@/lib/i18n";

/**
 * 제목의 우선순위 계약. 세 층이 있고 순서가 뒤집히면 조용히 나빠진다.
 *
 *   1) 원문 표제어가 사건 꼴이면 그것 — **진본이 파생물보다 앞선다**
 *   2) 지은 제목(tools/name.mjs)
 *   3) 원문 문장
 *
 * 그리고 1·2 **둘 다** 같은 칸 중복 검사를 받는다. 처음 배선에서 2가 검사를 건너뛰어
 * 1919년 한국 열에 「3·1 운동」이 세 번 찍혔다(2026-09-12).
 *
 * 표제어가 **겹쳐서 밀려난 자리**에는 지은 제목이 설 수 있다. 한 칸에서 같은 표제어가
 * 여섯 번 나온다면(의화단 운동·녕왕의 난) 그것은 그 줄의 사건 이름이 아니라 링크된 상위
 * 항목이므로, 구체적인 제목이 대신 서는 것이 옳다. `tools/dedupe.mjs`가 그 제목을 짓는다.
 */
const ev = (o: Partial<LabelSource>): LabelSource => ({ title: "원문 문장입니다.", lang: "en", names: {}, ...o });

describe("제목 우선순위", () => {
  it("원문 표제어가 사건 꼴이면 지은 제목을 이긴다", () => {
    const e = ev({ names: { kr: { nat: "임진왜란" } }, name_ko: "조선 침공" });
    expect(eventLabel(e, "ko").name).toBe("임진왜란");
  });

  it("표제어가 사건 꼴이 아니면(인물·지명) 지은 제목이 쓰인다", () => {
    const e = ev({ names: { kr: { nat: "네덜란드" } }, name_ko: "하멜 일행 탈출" });
    expect(eventLabel(e, "ko").name).toBe("하멜 일행 탈출");
  });

  it("둘 다 없으면 원문 문장", () => {
    expect(eventLabel(ev({}), "ko").text).toBeDefined();
    expect(eventLabel(ev({}), "ko").name).toBeUndefined();
  });

  it("표제어도 중복 검사를 받는다 — 예전부터 있던 규칙", () => {
    const e = ev({ names: { kr: { nat: "임진왜란" } } });
    expect(eventLabel(e, "ko", new Set(["임진왜란"])).name).toBeUndefined();
  });

  it("지은 제목도 같은 검사를 받는다 — 같은 칸에 같은 이름이 두 번 찍히지 않게", () => {
    const e = ev({ name_ko: "3·1 운동" });
    expect(eventLabel(e, "ko", new Set(["3·1 운동"])).name).toBeUndefined();
  });

  it("표제어와 지은 제목이 **같은 이름**이면 둘 다 밀린다 — 중복 규칙이 무력해지지 않는다", () => {
    const e = ev({ names: { kr: { nat: "임진왜란" } }, name_ko: "임진왜란" });
    expect(eventLabel(e, "ko", new Set(["임진왜란"])).name).toBeUndefined();
  });

  it("표제어가 겹쳐 밀려난 자리에는 구체적인 지은 제목이 선다", () => {
    // 「의화단 운동」이 한 칸에 여섯 번이면 그 표제어는 링크된 상위 항목이지 그 줄의 이름이 아니다
    const e = ev({ names: { kr: { nat: "의화단 운동" } }, name_ko: "베이징 철수" });
    expect(eventLabel(e, "ko", new Set(["의화단 운동"])).name).toBe("베이징 철수");
  });

  it("지은 제목은 ko UI에만 — en·ja·zh는 아직 짓지 않았다", () => {
    const e = ev({ name_ko: "냉전 종식", lang: "en", title: "The Cold War ends." });
    expect(eventLabel(e, "en").name).toBeUndefined();
    expect(eventLabel(e, "ja").name).toBeUndefined();
  });
});
