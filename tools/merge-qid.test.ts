import { describe, expect, it } from "vitest";

import { namesMatch, normName, pickMergedQid } from "./merge-qid.mjs";

/**
 * 합칠 때 두 QID가 다르면 **표제어가 줄 이름과 같은 쪽**(2026-09-25, 대표 승인). 판단이 아니라 대조다 —
 * 둘 다 같거나 둘 다 다르면 대표 쪽을 그대로 두고 사람 판정 목록으로 넘긴다.
 */
const zhangJue = { qid: "Q197202", names_native: { ko: "장각", en: "Zhang Jue", ja: "張角", zh: "張角" } };
const yellowTurban = { qid: "Q751743", names_native: { ko: "황건적의 난", en: "Yellow Turban Rebellion", ja: "黄巾の乱", zh: "黃巾之亂" } };

describe("합칠 때의 QID", () => {
  it("대표가 인물이고 사라지는 쪽 표제어가 줄 이름이면 사라지는 쪽을 쓴다 — 황건적의 난", () => {
    expect(pickMergedQid(zhangJue, yellowTurban, "황건적의 난")).toBe("take");
  });

  it("대표 쪽 표제어가 줄 이름이면 그대로 — 현무문의 변", () => {
    const xuanwu = { qid: "Q1192865", names_native: { ko: "현무문의 변" } };
    const taizong = { qid: "Q9701", names_native: { ko: "당 태종" } };
    expect(pickMergedQid(xuanwu, taizong, "현무문의 변")).toBe("keep");
  });

  it("둘 다 줄 이름과 다르면 그대로 — 사람이 판정한다", () => {
    expect(pickMergedQid(zhangJue, { qid: "Q7209", names_native: { ko: "한나라" } }, "적미군 항복")).toBe("keep");
  });

  it("다른 언어 표제어가 맞아도 된다 — 줄 이름이 원문 그대로일 때", () => {
    expect(pickMergedQid(zhangJue, yellowTurban, "Yellow Turban Rebellion")).toBe("take");
  });

  it("QID가 같거나 한쪽이 없으면 할 일이 없다", () => {
    expect(pickMergedQid(yellowTurban, yellowTurban, "황건적의 난")).toBe("keep");
    expect(pickMergedQid({ names_native: {} }, yellowTurban, "황건적의 난")).toBe("keep");
  });
});

describe("이름 대조", () => {
  it("괄호 속 구분자 · 공백 · 가운뎃점을 뗀다", () => {
    expect(normName("서진 (오호 십육국)")).toBe("서진");
    expect(normName("히로시마·나가사키 원폭")).toBe("히로시마나가사키원폭");
  });

  it("빈 이름은 무엇과도 같지 않다", () => {
    expect(namesMatch({ ko: "" }, "")).toBe(false);
  });
});
