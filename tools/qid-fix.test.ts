import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { eventId } from "./event-id.mjs";

/**
 * **QID 교정표**(`curation/qid-fix.json`) — "이 줄은 사실 이 사건을 말한다".
 *
 * 줄의 QID가 사건이 아니라 인물·나라를 가리키면 교차 묶기가 그 줄을 뺀다. 1592년 임진왜란은
 * 일본 열이 도요토미 히데요시(Q187550)에, 중국 열이 같은 인물과 조선(Q28179)에 붙어 있어
 * 세 열이 같은 전쟁을 적고도 한 묶음이 되지 못했다(2026-09-25 진단 — PRD S3가 데이터에 없었다).
 *
 * 교정은 역사 판단이라 기계가 아니라 표로 한다. 그 대가로 **표가 원본에서 떨어져 나가는 것**을
 * 여기서 막는다 — 재수집으로 줄이 바뀌면 id가 바뀌거나 QID가 달라진다. 그때 발행은 조용히
 * 건너뛰고(옛 판단을 새 줄에 씌우지 않는다), 이 테스트가 빨개진다. prebuild가 vitest를 물고
 * 있으므로 **표를 고치기 전에는 배포가 안 나간다.**
 *
 * git에 있는 원본(curation/events)만 읽는다 — 발행물 없이도 돈다.
 */
const ROOT = path.join(__dirname, "..");
const table = JSON.parse(readFileSync(path.join(ROOT, "curation/qid-fix.json"), "utf8")) as {
  fixes: { id: string; region: string; year: number; from: string; qid: string; why: string }[];
};

type Row = { source_id: string; status: string; region: string; date: { year: number }; title: string; qid?: string };
const rows: Row[] = [];
for (const f of readdirSync(path.join(ROOT, "curation/events"))) {
  if (!f.endsWith(".jsonl")) continue;
  for (const l of readFileSync(path.join(ROOT, "curation/events", f), "utf8").split("\n")) {
    if (l.trim()) rows.push(JSON.parse(l));
  }
}
const byId = new Map(rows.filter((r) => r.status === "published").map((r) => [eventId(r), r]));

describe("QID 교정표", () => {
  it("교정이 있다 — 비면 임진왜란이 다시 흩어진다", () => {
    expect(table.fixes.length).toBeGreaterThan(0);
  });

  it("id가 겹치지 않는다", () => {
    const ids = table.fixes.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모양이 맞다 — QID 꼴, 고칠 것이 실제로 다르다, 근거가 있다", () => {
    for (const f of table.fixes) {
      expect(f.id, f.id).toMatch(/^ev_[0-9a-f]{12}$/);
      expect(f.from, f.id).toMatch(/^Q\d+$/);
      expect(f.qid, f.id).toMatch(/^Q\d+$/);
      expect(f.qid, f.id).not.toBe(f.from);
      expect(f.why.length, f.id).toBeGreaterThan(10);
    }
  });

  /**
   * 핵심. 표의 줄이 **지금 원본에 그대로 있는가** — 같은 id, 같은 열·해, 그리고 `from`이 아직 그 줄의 QID인가.
   * 하나라도 어긋나면 그 교정은 발행에서 건너뛰어진다. 조용히 빠지는 대신 여기서 멈춘다.
   */
  it("교정마다 원본 줄이 그대로 있고 QID가 from 그대로다", () => {
    for (const f of table.fixes) {
      const r = byId.get(f.id);
      expect(r, `${f.id}: 원본에 없다 — 재수집으로 줄이 바뀌었다. 새 id로 표를 고친다`).toBeDefined();
      expect(r!.region, f.id).toBe(f.region);
      expect(r!.date.year, f.id).toBe(f.year);
      expect(r!.qid, `${f.id}: QID가 ${f.from}이 아니다 — 원본이 바뀌었으니 판단을 다시 한다`).toBe(f.from);
    }
  });

  /**
   * 고친 QID가 **사건**인가. 사건 판정 재료(`_qid-sitelinks.json`)는 수집 산출물이라 git에 없다 —
   * 없으면 건너뛴다.
   */
  const factsPath = path.join(ROOT, "curation/raw/_qid-sitelinks.json");
  it.skipIf(!existsSync(factsPath))("고친 QID는 인물이 아니다", () => {
    const facts = JSON.parse(readFileSync(factsPath, "utf8")).facts as Record<string, { human?: boolean }>;
    for (const f of table.fixes) expect(facts[f.qid]?.human ?? false, `${f.id} → ${f.qid}`).toBe(false);
  });
});
