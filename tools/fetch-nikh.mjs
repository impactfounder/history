/**
 * 국사편찬위원회 연표 가져오기 — data-model §4-1 (한국 열 공식 출처, 2026-09-05 A-16).
 *
 * 공공데이터포털 "교육부 국사편찬위원회_한국역사자료 메타데이터 정보_연표"
 *   https://www.data.go.kr/data/15051036/fileData.do
 *   공공누리 · 이용허락범위 제한 없음. CSV 215,536행 · 21개 연표(2022-10 갱신본).
 *
 * ZIP을 받아 풀고, 필요한 열만 골라 curation/raw/nikh/timeline.jsonl 로 쓴다(gitignore).
 * 원본 CSV는 131MB라 레포에 넣지 않는다 — 이 스크립트가 재현 경로다.
 *
 * 날짜(사건발생일) 규칙 — 실제 값에서 읽어낸 것:
 *   1945-08-15        양력
 *   1882-06-09L0      L = 음력, 뒤 숫자 = 윤달 여부
 *   -0057-04-99       음수 연도 = 기원전 57년(천문학적 연수가 아님 → 우리 축은 1 - 57 = -56)
 *   99                모르는 달·날
 *
 * 사용:
 *   node tools/fetch-nikh.mjs                          내려받기 + 풀기 + 변환
 *   node tools/fetch-nikh.mjs --from path/to/file.csv  이미 받은 CSV만 변환
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = "curation/raw/nikh";
const OUT = path.join(DIR, "timeline.jsonl");
const DOWNLOAD = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000002641538&fileDetailSn=1&insertDataPrcus=N";

mkdirSync(DIR, { recursive: true });

// ── 1. CSV 확보 ─────────────────────────────────────────────────────────────
let csvPath = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : null;
if (!csvPath) {
  const zip = path.join(DIR, "nikh-timeline.zip");
  if (!existsSync(zip)) {
    console.log("내려받기 …", DOWNLOAD);
    const res = await fetch(DOWNLOAD);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync("tar", ["-xf", zip, "-C", DIR]); // Windows 10+·macOS·리눅스 모두 bsdtar가 zip을 푼다
  csvPath = readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => path.join(DIR, f))[0];
  if (!csvPath) throw new Error("ZIP 안에 CSV가 없다");
}
console.log("CSV", csvPath);

// ── 2. CSV 파싱 (RFC 4180 — 따옴표 안 줄바꿈·쉼표 허용) ────────────────────
const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const rows = [];
let row = [], field = "", q = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (q) {
    if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
    else field += c;
  } else if (c === '"') q = true;
  else if (c === ",") { row.push(field); field = ""; }
  else if (c === "\n" || c === "\r") {
    if (c === "\r" && text[i + 1] === "\n") i++;
    row.push(field); field = ""; rows.push(row); row = [];
  } else field += c;
}
if (field || row.length) { row.push(field); rows.push(row); }
const header = rows.shift();
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const need = ["통합메타데이터 ID", "DB정보", "제목", "대체제목", "초록", "기사레벨", "상위자료", "사건발생일", "연계주소"];
for (const n of need) if (!(n in col)) throw new Error(`열 없음: ${n}`);

// ── 3. 변환 ─────────────────────────────────────────────────────────────────
const DATE_RE = /^(-?\d{4})-(\d{2})-(\d{2})(?:L(\d))?$/;
function parseDate(s) {
  const m = DATE_RE.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const d = { y: n < 0 ? n + 1 : n }; // 기원전 N년 → 1 - N
  if (m[2] !== "99") d.m = Number(m[2]);
  if (m[3] !== "99") d.d = Number(m[3]);
  if (m[4] !== undefined) { d.cal = "lunar"; if (m[4] === "1") d.leap = true; }
  return d;
}
const urlOf = (s) => /https?:\/\/[^<>"\s]+/.exec(s ?? "")?.[0] ?? null;
/** CSV에 HTML 엔티티가 이중으로 남아 있다("＜Flying fish&amp;gt;호"). 표시용이니 푼다. */
const decodeEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");

const out = [];
const skipped = { noDate: 0, noTitle: 0 };
const byDb = {};
for (const r of rows) {
  if (r.length < header.length - 1) continue;
  const get = (n) => (r[col[n]] ?? "").trim();
  const date = parseDate(get("사건발생일"));
  if (!date) { skipped.noDate++; continue; }
  const title = decodeEntities(get("제목"));
  if (!title) { skipped.noTitle++; continue; }
  const db = get("DB정보");
  byDb[db] = (byDb[db] ?? 0) + 1;
  const rec = {
    id: get("통합메타데이터 ID"),
    db,
    series: get("대체제목") || get("상위자료") || null,
    level: Number(get("기사레벨")) || null,
    date,
    title,
    text: decodeEntities(get("초록")) || title,
    url: urlOf(get("연계주소")),
  };
  out.push(rec);
}
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");

const years = new Map();
for (const r of out) years.set(r.date.y, (years.get(r.date.y) ?? 0) + 1);
const top = [...years.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`→ ${OUT}
  행 ${rows.length} → 수록 ${out.length} (날짜 없음 ${skipped.noDate} · 제목 없음 ${skipped.noTitle})
  연표별 ${Object.entries(byDb).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}
  연도 ${years.size}개 · 가장 촘촘한 해 ${top.map(([y, n]) => `${y}:${n}`).join(" ")}`);
