/**
 * LLM 초안 — data-model §4-2의 [초안] 단계.
 *
 * `curation/raw/{region}/candidates.jsonl`의 후보 행을 읽어 사건 레코드 초안을
 * 만든다. 하는 일 넷:
 *   1. 한 줄에 뭉친 여러 사건을 쪼갠다 (§5-1이 남긴 문제)
 *   2. title_ko(중립 라벨)·summary_ko를 **사실에서 새로 쓴다**
 *   3. category·scope·importance 초안
 *   4. 원문 재사용을 기계로 막는다 (editorial-policy §1-6, `overlap.mjs`)
 *
 * 모델은 mvmt-core 레지스트리 별칭 `standard`를 쓴다. ID 하드코딩 금지
 * (전사 규칙 9-A, PRD §8). 별칭을 바꾸는 것은 실제 모델 변경이므로 대표 승인 사항.
 *
 * 사용:
 *   node tools/draft.mjs kr --limit 50        실제 호출
 *   node tools/draft.mjs kr --limit 50 --dry  호출 없이 토큰·비용만 추정
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL_ALIASES } from "../src/lib/mvmt/models.mjs";
import { checkOverlap } from "../src/lib/curation/overlap.mjs";

const MODEL = CLAUDE_MODEL_ALIASES.standard;
/** 한 요청에 넣는 후보 행 수. 시스템 프롬프트를 분산시키면서 응답이 잘리지 않는 크기. */
const BATCH = 12;

// ─────────────────────────────────────────────────────────────────────────────
// 프롬프트
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM = `너는 한국어 역사 연표 데이터의 큐레이션 보조다. 위키백과 연표에서 긁어온 줄을 받아 사건 레코드 초안을 만든다.

## 가장 중요한 규칙 — 원문을 베끼지 마라
요약문은 원문을 요약하거나 번역한 것이 아니라, **사실(연도·주체·결과)만 뽑아 새로 쓴 문장**이어야 한다. 원문과 연속으로 겹치는 어절이 5개를 넘으면 그 레코드는 기계 검사에서 자동 반려된다. 이것은 문체 취향이 아니라 라이선스 요건이다.
- 원문: "1592년 4월 13일, 도요토미 히데요시가 조선을 침략하여 임진왜란이 시작되었다"
- 나쁨: "도요토미 히데요시가 조선을 침략하여 임진왜란이 시작됨" ← 그대로 옮김
- 좋음: "일본군이 부산에 상륙하며 7년간의 전쟁이 시작된 해"

## 한 줄에 여러 사건이 있으면 쪼갠다
"1920년 홍범도가 봉오동 전투에서 일본군을 격퇴, 김좌진이 청산리 대첩에서 일본군을 대파, 훈춘 사건" → 사건 3개.

## 사건이 아닌 것은 걸러낸다
연도를 특정할 수 없는 기간 서술("철기시대", "구석기 시대", "15세기에 융성했다")은 사건이 아니라 시대 구분이다. \`kind: "period"\`로 표시하고 요약을 쓰지 마라.

## 필드
- title_ko: 중립 라벨. 짧은 명사구("임진왜란", "무오사화", "고려 광종 즉위")
- summary_ko: 1~2문장. 연도·주체·결과. 원문 재사용 금지
- category: politics | war | culture | science | economy | disaster | person
- scope: local | regional | global
- importance: 1~5. 5는 교과서 첫 줄에 나오는 급(임진왜란·한국전쟁), 3이 기본
- kind: event | period
- year: 천문학적 연수. 입력의 year를 그대로 쓰되 명백히 틀렸으면 고친다`;

/** @param {any[]} rows */
function userPrompt(rows) {
  return (
    "아래 후보 줄들을 사건 레코드로 만들어라. 각 입력의 `id`를 결과의 `from`에 그대로 넣어라.\n\n" +
    rows
      .map((r, i) => `[${i}] id=${r.id} year=${r.date.year}\n${r.text}`)
      .join("\n\n")
  );
}

const SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "입력 줄의 id" },
          kind: { type: "string", enum: ["event", "period"] },
          year: { type: "integer" },
          title_ko: { type: "string" },
          summary_ko: { type: "string" },
          category: {
            type: "string",
            enum: ["politics", "war", "culture", "science", "economy", "disaster", "person"],
          },
          scope: { type: "string", enum: ["local", "regional", "global"] },
          importance: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["from", "kind", "year", "title_ko", "category", "scope", "importance"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
};

// ─────────────────────────────────────────────────────────────────────────────

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  const region = process.argv[2];
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
  const dry = process.argv.includes("--dry");
  if (!region) {
    console.error("사용: node tools/draft.mjs <region> [--limit N] [--dry]");
    process.exit(1);
  }

  const raw = await readFile(`curation/raw/${region}/candidates.jsonl`, "utf8");
  const rows = raw
    .trim()
    .split("\n")
    .map((l, i) => ({ id: `r${i}`, ...JSON.parse(l) }))
    .slice(0, limit);

  const batches = chunk(rows, BATCH);
  const client = new Anthropic();

  if (dry) {
    // 실제 호출 없이 입력 토큰만 세어 비용을 가늠한다.
    let inputTokens = 0;
    for (const b of batches.slice(0, 3)) {
      const c = await client.messages.countTokens({
        model: MODEL,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt(b) }],
      });
      inputTokens += c.input_tokens;
    }
    const perBatch = inputTokens / Math.min(3, batches.length);
    const totalIn = perBatch * batches.length;
    const totalOut = rows.length * 160; // 레코드당 출력 (가정)
    console.log(`모델 ${MODEL} (별칭 standard)
행 ${rows.length} · 배치 ${batches.length}개 (배치당 ${BATCH}행)
입력 토큰 추정 ${Math.round(totalIn).toLocaleString()} · 출력 토큰 추정 ${totalOut.toLocaleString()} (가정)
※ 단가는 모델마다 다르므로 여기서 금액을 계산하지 않는다. 위 토큰 수로 판단할 것.`);
    return;
  }

  const out = [];
  const stats = { drafted: 0, rejected: 0, periods: 0, split: 0 };

  for (const [i, b] of batches.entries()) {
    process.stderr.write(`배치 ${i + 1}/${batches.length} … `);
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: userPrompt(b) }],
    });

    const text = res.content.find((x) => x.type === "text")?.text ?? "{}";
    const { events = [] } = JSON.parse(text);
    if (events.length > b.length) stats.split += events.length - b.length;

    for (const ev of events) {
      const src = b.find((r) => r.id === ev.from);
      if (!src) continue;

      // editorial-policy §1-6 강제 — 원문 재사용은 기계가 막는다
      const overlap = ev.summary_ko ? checkOverlap(src.text, ev.summary_ko) : { ok: true, reasons: [] };
      if (ev.kind === "period") stats.periods++;
      if (!overlap.ok) stats.rejected++;
      else stats.drafted++;

      out.push({
        status: overlap.ok ? "needs_review" : "rejected",
        rejected_reason: overlap.ok ? undefined : overlap.reasons.join(" / "),
        region,
        kind: ev.kind,
        date: { year: ev.year, precision: src.date.precision, era: src.date.era },
        title_ko: ev.title_ko,
        summary_ko: ev.summary_ko ?? null,
        category: ev.category,
        scope: ev.scope,
        importance_auto: ev.importance,
        qid: src.qid,
        names_native: src.names_native,
        source: src.source,
        source_text: src.text,
        model: MODEL,
      });
    }
    process.stderr.write(`${events.length}건\n`);
  }

  await mkdir("curation/events", { recursive: true });
  await writeFile(
    `curation/events/${region}.jsonl`,
    out.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8",
  );

  console.log(`
초안 — ${region} (모델 ${MODEL})
  입력 행       ${rows.length}
  생성 레코드   ${out.length}  (쪼개져 늘어난 것 ${stats.split})
  검토 대기     ${stats.drafted}
  자동 반려     ${stats.rejected}  ← 원문 재사용(editorial-policy §1-6)
  시대 구분     ${stats.periods}  ← polities로 보낼 후보

기록: curation/events/${region}.jsonl`);
}

main().catch((e) => {
  const msg = String(e?.message ?? "");
  if (
    e instanceof Anthropic.AuthenticationError ||
    /authentication method|apikey|api[_ ]key|x-api-key/i.test(msg)
  ) {
    console.error(
      "인증 credential이 없다. 둘 중 하나를 하고 다시 실행할 것:\n" +
        "  1) ANTHROPIC_API_KEY를 .env에 둔다 (전사 규칙 8 — 코드·커밋·로그에 남기지 말 것)\n" +
        "  2) `ant auth login`으로 프로필을 만든다 (SDK가 자동으로 읽는다)",
    );
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
