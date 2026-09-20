import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **파이프라인 되돌이를 강제한다.** `summaries.mjs`와 `derive.mjs`는 서로를 문다:
 *
 *   summaries.mjs  curation/events/*.jsonl 의 names_native.ko 를 **읽어** 표제어 목록을 만든다
 *   derive.mjs     curation/summaries/ko.jsonl 을 **읽어** about(상세의 「관련 문서」)을 붙인다
 *
 * 그래서 새 열은 **derive → summaries → derive** 로 두 번 돌아야 한다. 한 번만 돌면 그 열은
 * 설명이 없는 채로 조용히 나간다 — 아무것도 깨지지 않고 상세 패널만 비어 있다.
 *
 * 실제로 AI 열이 그렇게 나갔다(2026-09-20). ko 표제어 147건 중 **139건이 캐시에 없어** 관련 문서가
 * 3%였고, 다른 네 열은 34~57%였다. 제품 이름을 가진 1열이 가장 비어 있었다.
 *
 * 이 테스트는 **네트워크를 쓰지 않는다.** "받아왔는가"가 아니라 "물어는 봤는가"만 본다.
 * `summaries.mjs`는 문서가 없거나 동음이의여도 `{missing:true}` 줄을 캐시에 남기므로
 * (`tools/summaries.mjs` fetchBatch), 캐시에 표제어가 **있기만 하면** 그 단계는 돈 것이다.
 * 한국어 위키에 문서가 없는 표제어 때문에 영영 빨개지는 일은 없다.
 *
 * 빨개지면 고치는 법: `MVMT_CONTACT=<연락처 URL 또는 메일> node tools/summaries.mjs`
 * 그다음 `node tools/derive.mjs <열>` — 순서를 뒤집으면 캐시가 비어 있는 채로 derive가 돈다.
 */
const root = path.join(__dirname, "..");
const EVENTS = path.join(root, "curation/events");
const CACHE = path.join(root, "curation/summaries/ko.jsonl");

const lines = (p: string) => readFileSync(p, "utf8").split("\n").filter(Boolean);

/** 캐시가 답을 가진 표제어. 본문이 있든(`extract`) 없든(`missing`) 물어본 것은 물어본 것이다. */
const asked = new Set(lines(CACHE).map((l) => JSON.parse(l).title as string));

/** 발행되는 행만 본다 — rejected 는 화면에 없으므로 설명이 필요 없다. */
const regionFiles = readdirSync(EVENTS).filter((f) => f.endsWith(".jsonl"));

describe("summaries 캐시가 발행되는 모든 ko 표제어를 덮는다", () => {
  it("열 파일을 찾았다 — 경로가 바뀌면 아래 검사가 통째로 무의미해진다", () => {
    expect(regionFiles.length).toBeGreaterThan(0);
    expect(asked.size).toBeGreaterThan(0);
  });

  it.each(regionFiles)("%s", (file) => {
    const missing = new Set<string>();
    for (const line of lines(path.join(EVENTS, file))) {
      const r = JSON.parse(line);
      if (r.status !== "published") continue;
      const ko = r.names_native?.ko;
      if (ko && !asked.has(ko)) missing.add(ko);
    }
    expect(
      [...missing],
      `${file}: ko 표제어 ${missing.size}개가 summaries 캐시에 없다 — summaries.mjs 를 돌리고 이 열을 다시 derive 하라. 예) ${[...missing].slice(0, 5).join(" / ")}`,
    ).toEqual([]);
  });
});

describe("캐시 줄의 모양", () => {
  it("본문이 있거나 missing 표시가 있거나 — 둘 중 하나다", () => {
    const bad = lines(CACHE)
      .map((l) => JSON.parse(l))
      .filter((s) => !s.title || (!s.extract?.trim() && !s.missing));
    expect(bad.map((s) => s.title)).toEqual([]);
  });
});

describe("되돌이의 뒷반쪽 — summaries 는 돌렸는데 derive 를 다시 안 했다", () => {
  /**
   * 위 검사는 "물어봤는가"만 본다. 캐시에 표제어가 들어와도 `derive.mjs`를 **다시 돌리지 않으면**
   * about 은 여전히 비어 있다 — 버그의 뒷반쪽이고 증상이 똑같이 조용하다. 그래서 따로 본다.
   *
   * 실측으로 확인했다(2026-09-20): 캐시만 새것으로 두고 ai.jsonl 을 되돌리면 위 검사는 전부 green이고
   * **이 검사만 139행으로 빨개진다.** 앞 검사를 되돌리면 반대로 이것이 green이고 앞이 빨개진다.
   */
  it("캐시에 본문이 있는데 about 이 없는 발행 행은 없다 (derive 재실행 확인)", () => {
    const withText = new Map(
      lines(CACHE).map((l) => JSON.parse(l)).filter((s) => s.extract?.trim()).map((s) => [s.title as string, true]),
    );
    const stale: string[] = [];
    for (const file of regionFiles) {
      for (const line of lines(path.join(EVENTS, file))) {
        const r = JSON.parse(line);
        if (r.status !== "published") continue;
        const ko = r.names_native?.ko;
        if (ko && withText.has(ko) && !r.about?.text) stale.push(`${file}:${ko}`);
      }
    }
    expect(stale.slice(0, 5), `${stale.length}행이 캐시에는 설명이 있는데 about 이 비어 있다 — 해당 열을 derive 하라`).toEqual([]);
  });
});

it("캐시 파일이 있다", () => {
  expect(existsSync(CACHE)).toBe(true);
});
