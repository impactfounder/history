import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **중복 판정(`curation/names/clash.jsonl`)은 한 줄만 가리켜야 한다.**
 *
 * 수집의 행 id(`rowId` = 문서·판·본문)는 본문이 같으면 같다. 중국 연표의 「Xuan died.」는 주 선왕(기원전 782)과
 * 한 선제(기원전 49) 두 줄인데 id가 같다 — 2026-09-26 기준 중국 29개 · 일본 2개 · 미국 2개 id가 이렇게 여러 줄에
 * 걸린다. 발행 id는 연도가 들어가 갈라지지만, 판정은 source_id로 적용되므로(publish.mjs `clash.drop`) 「같은
 * 사건이니 버린다」가 이런 id에 내려지면 **이름만 같은 다른 사건까지 함께 사라진다.** 걸리면 그 판정을 지우거나,
 * 수집 id가 줄마다 갈라지게 고친 뒤 다시 판정한다.
 *
 * 판정은 그 열 안에서만 적용된다(publish.mjs `clashKey` = 열|id). 처음 이 테스트를 열 구분 없이 세었을 때
 * 「왕샤 조약」 판정이 걸렸고, 그것이 실제로 미국 열의 같은 id 줄을 지우고 있었다 — 그래서 키에 열을 넣었다.
 *
 * git에 있는 원본(curation/events)만 읽는다 — 발행물 없이도 돈다.
 */
const EVENTS = path.join(process.cwd(), "curation/events");
const CLASH = path.join(process.cwd(), "curation/names/clash.jsonl");

describe.skipIf(!existsSync(CLASH))("clash 판정 — 겹치는 source_id를 가리키지 않는다", () => {
  const count = new Map<string, number>();
  for (const f of readdirSync(EVENTS).filter((f) => f.endsWith(".jsonl"))) {
    for (const l of readFileSync(path.join(EVENTS, f), "utf8").split("\n").filter(Boolean)) {
      const r = JSON.parse(l) as { source_id: string; region: string };
      const k = `${r.region}|${r.source_id}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const judged = readFileSync(CLASH, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { g: string; same?: boolean; primary?: string; drop?: string[] });

  it("같은 사건(same=true) 판정의 대표·버림 id가 각각 한 줄에만 있다", () => {
    const bad = judged
      .filter((d) => d.same === true)
      .flatMap((d) => {
        const reg = d.g.split("|")[0];
        return [d.primary, ...(d.drop ?? [])]
          .filter((id): id is string => !!id && (count.get(`${reg}|${id}`) ?? 0) > 1)
          .map((id) => `${d.g} · ${id} ×${count.get(`${reg}|${id}`)}`);
      });
    expect(bad).toEqual([]);
  });
});
