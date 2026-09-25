import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { yearMetadata } from "@/lib/metadata";
import { AXIS_YEAR_START } from "@/lib/timeline/axis";
import { DATA_END_YEAR } from "@/lib/year-data";

/**
 * **빈 연도 페이지는 색인하지 않는다**(2026-09-25, 진단 보고서 개선 3의 도메인과 무관한 절반).
 *
 * 연도 페이지 2,526개 중 609개가 그 해 사건 0건이었다 — 앞뒤 2년 문맥만 있는 페이지가 네 언어로 2,436개 URL이
 * 되어 사이트맵에 올라가 있었다. 그 해들은 사이트맵에서 빼고 `noindex`로 둔다. 페이지는 남는다.
 *
 * 「사건이 있는 해」를 여기서는 **연도 청크에서 직접** 센다 — 사이트맵은 years.json을 읽으므로, 두 길이 같은
 * 답을 내는지가 곧 검사다.
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const published = existsSync(path.join(DATA, "years.json"));

describe.skipIf(!published)("빈 연도 페이지", () => {
  const withEvents = new Set<number>();
  for (const r of readdirSync(path.join(DATA, "events"))) {
    const dir = path.join(DATA, "events", r, "year");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) for (const e of JSON.parse(readFileSync(path.join(dir, f), "utf8")).events ?? []) withEvents.add(e.y0);
  }
  const all = Array.from({ length: DATA_END_YEAR - AXIS_YEAR_START + 1 }, (_, i) => AXIS_YEAR_START + i);
  const empty = all.filter((y) => !withEvents.has(y));
  const full = all.filter((y) => withEvents.has(y));

  it("빈 해가 있다 — 0이면 아래 검사가 무의미하다", () => {
    expect(empty.length).toBeGreaterThan(100);
  });

  it("사이트맵의 연도 URL은 사건이 있는 해 × 네 언어뿐이다", async () => {
    const urls = (await sitemap()).map((e) => e.url).filter((u) => /\/y\/-?\d+$/.test(u));
    expect(urls.length).toBe(full.length * 4);
    const years = new Set(urls.map((u) => Number(u.match(/\/y\/(-?\d+)$/)![1])));
    for (const y of empty.slice(0, 50)) expect(years.has(y), `${y}년은 비었는데 사이트맵에 있다`).toBe(false);
  });

  it("빈 해의 페이지는 noindex, 사건이 있는 해는 색인한다", async () => {
    const e = empty[0]!, f = full.find((y) => y > 1000)!;
    expect((await yearMetadata(e, "ko")).robots).toMatchObject({ index: false, follow: true });
    expect((await yearMetadata(f, "ko")).robots).toBeUndefined();
    expect((await yearMetadata(e, "en")).robots).toMatchObject({ index: false });
  });
});
