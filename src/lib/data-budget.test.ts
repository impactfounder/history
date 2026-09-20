import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * **첫 화면이 받는 바이트의 상한.** PRD §5-7 성능 예산은 「첫 뷰포트 JSON ≤ 50KB」를 적어 두었지만
 * 그것을 세는 것이 아무 데도 없었고, 그 사이 `manifest.json`이 **1,321KB(gzip 574KB)**까지 자랐다.
 *
 * manifest가 특히 아픈 이유: 그리드가 `cache: "no-cache"`로 받아 **매번 재검증한다**(발행 버전을
 * 알아야 나머지 URL에 `?v=`를 붙일 수 있다). 그런데 읽는 값은 `stage`·`counts.events`·`publishedAt`
 * 셋뿐이었고, 부피의 99.97%는 파일 무결성 색인(`chunks`: 경로 → sha256, 항목 13,217개 중 11,365개가
 * `events/detail/*.json`)이었다. **읽는 코드는 레포 어디에도 없었다.**
 * (`TimelineGrid`의 `chunks`는 이름만 같은 로컬 `useRef` 캐시다.)
 *
 * 2026-09-20에 `chunks.json`으로 뺐다 — 지운 것이 아니라 첫 화면의 길에서 치웠다.
 *
 * 이 테스트는 **manifest만** 지킨다. 착지 청크(실측 gzip 251KB)는 예산의 5배지만 그것은 데이터
 * 자체의 크기라 상한 하나로 자를 수 없다 — 줄이려면 오버스캔이나 청크 분할을 바꿔야 하고 별건이다.
 * 여기서 막는 것은 **"작아야 하는 것이 조용히 커지는 일"** 하나다.
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const manifestPath = path.join(DATA, "manifest.json");

/** 발행 산출물은 git에 없다(`prebuild`가 만든다). 없으면 이 테스트는 할 말이 없다. */
const published = existsSync(manifestPath);

describe.skipIf(!published)("manifest는 작아야 한다 — 매 첫 로드에 재검증된다", () => {
  /** 넉넉하지만 `chunks`가 다시 들어오면 바로 깨지는 값. 지금 333B, 색인이 들어오면 1.3MB다. */
  const LIMIT = 4 * 1024;

  it(`${LIMIT / 1024}KB를 넘지 않는다`, () => {
    const raw = statSync(manifestPath).size;
    expect(raw, `manifest.json이 ${(raw / 1024).toFixed(1)}KB다 — 첫 화면에서 읽지 않는 것이 들어왔는지 보라`).toBeLessThanOrEqual(LIMIT);
  });

  it("파일 색인을 다시 품지 않는다", () => {
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(Object.keys(m).sort()).toEqual(["counts", "publishedAt", "stage", "version"]);
    expect(m.chunks, "chunks는 chunks.json에 있어야 한다").toBeUndefined();
  });

  it("클라이언트가 읽는 세 값은 그대로 있다", () => {
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(m.stage).toMatch(/^(published|preview)$/);
    expect(typeof m.counts?.events).toBe("number");
    expect(m.publishedAt).toBeTruthy();
  });

  it("색인은 사라지지 않았다 — 옮겼을 뿐이다", () => {
    const p = path.join(DATA, "chunks.json");
    expect(existsSync(p), "chunks.json이 없다").toBe(true);
    const c = JSON.parse(readFileSync(p, "utf8")).chunks;
    expect(Object.keys(c).length).toBeGreaterThan(1000);
  });

  it("gzip으로도 1KB 아래다 — 재검증 비용이 사실상 0이다", () => {
    const gz = gzipSync(readFileSync(manifestPath), { level: 9 }).length;
    expect(gz).toBeLessThan(1024);
  });
});

/**
 * **검색 색인은 첫 화면의 길에 없다.**
 *
 * `search.json`은 10,332항목 · gzip 256KB다. 착지 데이터가 이미 예산(50KB)의 다섯 배라
 * 여기에 얹으면 안 된다 — 검색을 **처음 열 때** 받는다(`src/lib/search.ts`의 `loadSearchIndex`).
 *
 * 지키기 쉬운 약속이 아니다: 그리드 어딘가에서 한 줄만 무심코 부르면 256KB가 첫 로드로 돌아온다.
 * 그래서 **소스를 읽어** 색인을 부르는 곳이 검색 모듈뿐인지 본다.
 */
describe("검색 색인은 지연 로드다", () => {
  const grid = readFileSync(path.join(__dirname, "../components/timeline/TimelineGrid.tsx"), "utf8");
  const overlay = readFileSync(path.join(__dirname, "../components/timeline/SearchOverlay.tsx"), "utf8");

  it("그리드는 색인을 직접 받지 않는다", () => {
    expect(grid).not.toContain("loadSearchIndex");
  });

  it("색인 URL은 오버레이에만 건네진다 — 오버레이는 열려야 생긴다", () => {
    // 그리드는 URL을 만들어 넘기기만 한다(첫 로드에 받지 않는다)
    expect(grid).toContain("search.json");
    expect(grid).toContain("{searchOpen && (");
    // 실제 fetch는 오버레이가 마운트된 뒤 effect에서
    expect(overlay).toContain("loadSearchIndex");
  });

  it.skipIf(!published)("색인이 발행돼 있고 manifest와 따로다", () => {
    const p = path.join(DATA, "search.json");
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, "utf8"));
    expect(Array.isArray(j.items)).toBe(true);
    expect(j.items.length).toBeGreaterThan(5000);
    // manifest에 섞여 들어오면 매 첫 로드에 재검증된다 — 그것이 574KB 사고의 모양이었다
    const m = JSON.parse(readFileSync(path.join(DATA, "manifest.json"), "utf8"));
    expect(m.search).toBeUndefined();
    expect(m.items).toBeUndefined();
  });

  it.skipIf(!published)("한 항목의 모양이 계약대로다", () => {
    const j = JSON.parse(readFileSync(path.join(DATA, "search.json"), "utf8"));
    for (const it of j.items.slice(0, 200)) {
      expect(typeof it[0]).toBe("string"); // 이름
      expect(typeof it[1]).toBe("number"); // 연도
      expect(typeof it[2]).toBe("string"); // 열
      expect(it[3]).toMatch(/^[0-9a-f]{12}$/); // id (ev_ 없음)
      expect(it[4]).toBeGreaterThanOrEqual(1); // 중요도
      expect(it[4]).toBeLessThanOrEqual(5);
    }
  });
});
