import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **사건 판정 사본**(`curation/qid-facts.json`)이 로컬과 CI를 같게 만드는가.
 *
 * 교차 묶기는 `isEventLike`로 사건을 가린다. 그 재료(위키데이터 유형)는 `curation/raw/`에 있고 그 폴더는
 * git 밖이라, Vercel 빌드는 유형 없이 판정해 배포본의 교차 묶음이 로컬보다 적었다(2026-09-25, 52 대 55).
 * 로컬 발행이 판정에 쓰일 수 있는 QID의 사실을 사본으로 쓰고, CI는 그것을 읽는다.
 *
 * 여기서는 **git 안의 것만으로** 판정 대상 QID를 다시 세어, 사본이 그것을 다 덮는지 본다 — 원본을 다시
 * 수집한 뒤 로컬에서 발행하지 않고 커밋하면 사본이 모자라고, 그러면 배포본이 다시 조용히 어긋난다.
 * 규칙은 tools/publish.mjs `judgedQids`와 같다: 두 열 이상의 줄에 나오는 QID + 교정표가 가리키는 QID.
 */
const ROOT = path.join(__dirname, "..");
const copy = JSON.parse(readFileSync(path.join(ROOT, "curation/qid-facts.json"), "utf8")).facts as Record<string, { human?: boolean; types: string[] }>;

const regions = new Map<string, Set<string>>();
for (const f of readdirSync(path.join(ROOT, "curation/events")).filter((x) => x.endsWith(".jsonl"))) {
  for (const l of readFileSync(path.join(ROOT, "curation/events", f), "utf8").split("\n")) {
    if (!l.trim()) continue;
    const r = JSON.parse(l) as { status: string; kind: string; qid?: string; region: string };
    if (r.status !== "published" || r.kind === "period" || !r.qid) continue;
    (regions.get(r.qid) ?? regions.set(r.qid, new Set()).get(r.qid)!).add(r.region);
  }
}
const judged = new Set([...regions].filter(([, s]) => s.size >= 2).map(([q]) => q));
for (const f of JSON.parse(readFileSync(path.join(ROOT, "curation/qid-fix.json"), "utf8")).fixes as { qid: string }[]) judged.add(f.qid);

describe("사건 판정 사본", () => {
  it("판정 대상 QID가 있다 — 0이면 아래 검사가 무의미하다", () => {
    expect(judged.size).toBeGreaterThan(50);
  });

  it("사본이 판정 대상을 다 덮는다 — 모자라면 배포본의 교차 묶음이 로컬과 달라진다", () => {
    const missing = [...judged].filter((q) => !(q in copy));
    expect(missing.slice(0, 10), `사본에 없는 QID ${missing.length}개 — 로컬에서 node tools/publish.mjs를 돌려 사본을 다시 쓴다`).toEqual([]);
  });

  it("사본 항목은 유형 목록을 가진다", () => {
    for (const [q, f] of Object.entries(copy)) expect(Array.isArray(f.types), q).toBe(true);
  });

  /** 임진왜란(Q576338)은 교정표로 세 열이 묶인다 — 그 판정이 CI에서도 서야 한다(유형: 전쟁 Q198). */
  it("임진왜란의 유형이 사본에 있다", () => {
    expect(copy.Q576338?.types).toContain("Q198");
  });
});
