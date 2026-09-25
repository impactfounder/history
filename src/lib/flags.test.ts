import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **열 아이콘 SVG는 올바른 XML이어야 한다.** `<img>`로 그리는 SVG는 브라우저가 엄격한 XML 파서로
 * 읽어서, 한 군데만 틀려도 파일 전체가 무효가 되고 **아무 경고 없이** 빈 칸이 된다.
 *
 * 실제로 그랬다: `ai.svg`의 설명 주석에 `--region-ai`라는 글자가 있었고, XML은 주석 안에 `--`를
 * 허용하지 않는다. AI 열이 기본 첫 열이 된 뒤(2026-09-20) 모든 사람의 첫 화면에서 AI 열 머리가
 * 비어 있었다(헤드리스 실측 naturalWidth 0, 다른 네 개는 900 이상). tsc도 테스트도 빌드도 통과했다.
 *
 * 전체 XML 검증기는 두지 않는다(의존성). 그 사고의 꼴 — 주석 안의 `--` — 과, 여는·닫는 루트만 본다.
 */
const DIR = path.join(__dirname, "../../public/flags");
const files = readdirSync(DIR).filter((f) => f.endsWith(".svg"));

describe("열 아이콘 SVG", () => {
  it("아이콘이 있다", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)("%s — 주석 안에 하이픈 두 개가 잇대어 있지 않다", (f) => {
    const s = readFileSync(path.join(DIR, f), "utf8");
    const comments = [...s.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1] ?? "");
    const bad = comments.filter((c) => c.includes("--") || c.endsWith("-"));
    expect(bad.map((c) => c.trim().slice(0, 60))).toEqual([]);
  });

  it.each(files)("%s — <svg>로 열고 </svg>로 닫는다", (f) => {
    const s = readFileSync(path.join(DIR, f), "utf8").trim().replace(/^<\?xml[^>]*\?>\s*/, "");
    expect(s.startsWith("<svg")).toBe(true);
    expect(s.endsWith("</svg>")).toBe(true);
  });
});
