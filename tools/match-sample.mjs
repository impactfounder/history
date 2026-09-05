/**
 * 국사편찬위 매칭 표본 검수 표 — 사람 눈이 필요한 유일한 단계(data-model §4-2 [검토]: 표본 점검).
 *
 * curation/events/kr.jsonl에서 공식 항목이 붙은 사건을 시대별로 층화해 N건 뽑아 마크다운 표로 쓴다.
 * 위키 줄 → 붙은 국사편찬위 항목(날짜·본문·매칭 근거). 틀린 행은 `curation/events/kr.jsonl`에서
 * 그 sources 항목을 지우고 커밋한다(status는 그대로 published — 출처만 정정).
 *
 * 사용: node tools/match-sample.mjs [N=40] [seed=7]  → curation/_probe/nikh-match-sample.md
 */

import { readFileSync, writeFileSync } from "node:fs";

const N = Number(process.argv[2] ?? 40);
let seed = Number(process.argv[3] ?? 7);
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

const rows = readFileSync("curation/events/kr.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const matched = rows.filter((r) => r.status === "published" && r.sources.some((s) => s.kind === "nikh"));
const era = (y) => (y < 938 ? "~937" : y < 1860 ? "938–1859" : y < 1946 ? "1860–1945" : "1946~");
const byEra = {};
for (const r of matched) (byEra[era(r.date.year)] ??= []).push(r);

// 시대별 비례 배분, 최소 4건
const picks = [];
for (const [e, list] of Object.entries(byEra)) {
  const k = Math.max(4, Math.round((N * list.length) / matched.length));
  const shuffled = [...list].sort(() => rnd() - 0.5);
  picks.push(...shuffled.slice(0, k).map((r) => ({ e, r })));
}
picks.sort((a, b) => a.r.date.year - b.r.date.year);

const yearKo = (y) => (y <= 0 ? `BC ${1 - y}` : String(y));
const nikhDate = (d) => `${yearKo(d.y)}${d.m ? ` ${d.cal === "lunar" ? "음" : ""}${d.m}/${d.d ?? "?"}` : ""}`;
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

let md = `# 국사편찬위 매칭 표본 검수 — ${new Date().toISOString().slice(0, 10)}

매칭 ${matched.length}행 중 ${picks.length}건(시대별 층화, seed ${process.argv[3] ?? 7}). **판정 열에 ○ / × / △(관련은 있으나 그 사건 아님)** 를 적는다.
× 행은 \`curation/events/kr.jsonl\`에서 해당 \`sources\` 항목(kind=nikh, id)을 지운다. 규칙 자체를 고칠 패턴이 보이면 \`src/lib/curation/nikh-match.mjs\`.

| # | 연도 | 위키 줄 (원문) | → 국사편찬위 항목 | 근거 | 판정 |
|---|---|---|---|---|---|
`;
picks.forEach(({ r }, i) => {
  const ns = r.sources.filter((s) => s.kind === "nikh");
  ns.forEach((s, j) => {
    md += `| ${j === 0 ? i + 1 : ""} | ${j === 0 ? yearKo(r.date.year) : ""} | ${j === 0 ? esc(r.text.slice(0, 90)) : "〃"} | **${esc(s.db.replace(/^주제별연표_/, ""))}** ${nikhDate(s.date)} · ${esc(s.text.slice(0, 110))} | ${esc(s.match.why.join(" "))} ${s.match.rank} | |\n`;
  });
});
md += `\n소스 id는 검수 뒤 정정할 때 쓴다:\n\n`;
picks.forEach(({ r }, i) => {
  md += `- ${i + 1}. \`${r.source_id}\` → ${r.sources.filter((s) => s.kind === "nikh").map((s) => `\`${s.id}\``).join(", ")}\n`;
});
writeFileSync("curation/_probe/nikh-match-sample.md", md);
console.log(`표본 ${picks.length}건 → curation/_probe/nikh-match-sample.md (시대별: ${Object.entries(byEra).map(([e, l]) => `${e} ${l.length}`).join(" · ")})`);
