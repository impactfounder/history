import { describe, expect, it } from "vitest";

import { orderRowGroups, rowSheetRegions } from "./row-sheet";

describe("행 시트의 열 순서", () => {
  it("보이는 열이 먼저, 격자 밖 열이 뒤 — 각자의 순서를 지킨다", () => {
    expect(rowSheetRegions(["ai", "kr"], ["ai", "kr", "cn", "jp", "us"])).toEqual(["ai", "kr", "cn", "jp", "us"]);
    expect(rowSheetRegions(["kr", "us"], ["ai", "kr", "cn", "jp", "us"])).toEqual(["kr", "us", "ai", "cn", "jp"]);
  });

  it("빈 열은 끝으로 — 1592년 폰 시트의 첫 자리가 「AI · 수록 사건 없음」이던 것", () => {
    const g = (region: string, total: number, loading = false) => ({ region, total, loading });
    const out = orderRowGroups([g("ai", 0), g("kr", 15), g("cn", 10), g("jp", 2), g("us", 0)]);
    expect(out.map((x) => x.region)).toEqual(["kr", "cn", "jp", "ai", "us"]);
  });

  it("아직 안 온 열은 비었는지 모르므로 제자리에 둔다", () => {
    const out = orderRowGroups([
      { region: "ai", total: 0, loading: true },
      { region: "kr", total: 0, loading: false },
      { region: "cn", total: 3, loading: false },
    ]);
    expect(out.map((x) => x.region)).toEqual(["ai", "cn", "kr"]);
  });
});
