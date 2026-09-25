import { describe, expect, it } from "vitest";

import { REPORT_TEXT_MAX, clipForReport, reportMailto } from "@/lib/report";
import { REPORT_EMAIL } from "@/lib/site";

/**
 * 오류 신고 메일(2026-09-25). 신고가 GitHub 이슈뿐일 때는 계정 없는 사람(1차 타깃 대부분)이 알려 줄 길이 없었다.
 */
describe("오류 신고 메일", () => {
  it("대표가 지정한 주소로 간다", () => {
    expect(REPORT_EMAIL).toBe("nyspirit@mensakorea.org");
    expect(reportMailto("제목", "본문").startsWith(`mailto:${REPORT_EMAIL}?`)).toBe(true);
  });

  it("사건 id가 본문에 실려 간다", () => {
    const u = new URL(reportMailto("[사건 오류] 1592년 · 임진왜란", "사건 id: ev_26c17480769c\n원문: …"));
    expect(decodeURIComponent(u.search)).toContain("ev_26c17480769c");
  });

  it("공백은 %20이다 — +로 보이는 메일 앱이 있다", () => {
    const u = reportMailto("사건 오류", "무엇이 틀렸나요");
    expect(u).toContain("%20");
    expect(u).not.toContain("+");
  });

  it("줄바꿈이 살아 간다", () => {
    expect(reportMailto("s", "a\nb")).toContain("a%0Ab");
  });

  it("긴 원문은 상한에서 자른다", () => {
    const long = "가".repeat(REPORT_TEXT_MAX + 50);
    expect(clipForReport(long).length).toBe(REPORT_TEXT_MAX + 1);
    expect(clipForReport(long).endsWith("…")).toBe(true);
    expect(clipForReport("짧은 원문")).toBe("짧은 원문");
  });
});
