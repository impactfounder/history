/**
 * **발행 사건 id.** `tools/publish.mjs`가 쓰던 것을 따로 뺐다 — publish.mjs는 import하면 CLI 본문이
 * 돌아 테스트할 수 없다(`founding.mjs`·`event-kind.mjs`를 뺀 것과 같은 이유). 교정표
 * (`curation/qid-fix.json`)가 이 id로 줄을 가리키므로, 표를 검사하는 테스트가 **같은 계산**을 써야 한다.
 * 두 벌이 되면 한쪽만 바뀌는 날 교정이 조용히 빗나간다.
 *
 * 연도를 넣는다 — 수집기의 행 id는 sha1(url|revid|text)라 **같은 문장이 여러 해에 반복되면**
 * 같은 id가 된다("Rebellion breaks out in Sichuan"이 송 연표에 네 번, 2026-09-05 중복 키 경고).
 *
 * 의존성 0.
 */
import { createHash } from "node:crypto";

export const eventId = (r) =>
  "ev_" + createHash("sha256").update(`${r.source_id}|${r.date.year}|${r.title}`).digest("hex").slice(0, 12);
