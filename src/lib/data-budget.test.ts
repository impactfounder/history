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
