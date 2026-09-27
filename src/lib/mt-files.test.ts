import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **청크가 적은 번역 언어 목록 = 실제 번역 파일**(publish.mjs writeMt, 2026-09-27).
 * 격자는 청크의 `mt` 목록에 있는 언어만 `mt/{lang}/{region}/{level}/{key}.json`을 받는다 — 목록에 있는데 파일이
 * 없으면 404, 파일이 있는데 목록에 없으면 번역이 있어도 한국어 원문이 뜬다. 번역 파일의 사건은 그 청크에 있어야 한다.
 */
const V1 = path.join(process.cwd(), "public/data/v1");
const published = existsSync(path.join(V1, "manifest.json"));

describe.skipIf(!published)("번역 파일 — 청크의 mt 목록과 일치한다", () => {
  it("목록 ↔ 파일 · 번역의 사건은 그 청크(앞+뒷부분)에 있다", () => {
    const bad: string[] = [];
    let files = 0;
    for (const region of readdirSync(path.join(V1, "events"))) {
      for (const level of ["century", "decade", "year"]) {
        const dir = path.join(V1, "events", region, level);
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.endsWith(".more.json"))) {
          const key = f.replace(/\.json$/, "");
          const chunk = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { mt?: string[]; events: { id: string }[] };
          const more = path.join(dir, `${key}.more.json`);
          const ids = new Set([...chunk.events, ...(existsSync(more) ? (JSON.parse(readFileSync(more, "utf8")).events as { id: string }[]) : [])].map((e) => e.id));
          for (const lang of ["en", "ja", "zh"]) {
            const mf = path.join(V1, "mt", lang, region, level, `${key}.json`);
            const listed = chunk.mt?.includes(lang) ?? false;
            if (listed !== existsSync(mf)) bad.push(`${region}/${level}/${key} ${lang}: 목록 ${listed} · 파일 ${existsSync(mf)}`);
            if (!existsSync(mf)) continue;
            files++;
            for (const id of Object.keys(JSON.parse(readFileSync(mf, "utf8")).t)) if (!ids.has(id)) bad.push(`${region}/${level}/${key} ${lang}: 청크에 없는 ${id}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
    expect(files).toBeGreaterThan(0);
  });
});
