import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * **계측기를 검사한다.** `tools/perf-probe.js`는 사람이 브라우저 콘솔에 붙여넣어 돌리는 도구라
 * CI가 실행할 일이 없다 — 그래서 망가져도 **조용히 틀린 숫자를 준다.** 한 번 쓰고 버리는 값이 아니라
 * PRD §11 C-9의 답으로 문서에 들어갈 값이므로, 도구 자체가 맞는지 여기서 본다.
 *
 * 브라우저 API를 흉내 내고 **60Hz 시계를 시뮬레이션**해 스크립트를 끝까지 돌린다. 프레임 간격이
 * 16.7ms로 고정된 세상이므로 정답을 알고 있다 — 기준선 중앙값은 16.7이어야 한다.
 *
 * (이 하니스를 만들다 한 번 속았다: `setTimeout`을 즉시 처리했더니 기준선 표본이 0이 나왔다.
 * 스크립트 버그가 아니라 하니스가 시간을 안 흘려보낸 탓이었다. 그래서 가상 시계를 제대로 돌린다.)
 */
const SRC = readFileSync(path.join(__dirname, "perf-probe.js"), "utf8");
const FRAME = 1000 / 60;

interface Stat { 표본: number; 중앙값?: number; p95?: number; 최대?: number; "33ms초과"?: number; "50ms초과"?: number }
interface Result { 환경: Record<string, unknown>; 기준선_가만히: Stat; 확대축소_40회: Stat; 스크롤_50프레임: Stat }

/** 스크립트를 가상 60Hz 브라우저에서 돌린다. `visible`을 바꿔 가드도 시험한다. */
async function run(visible: boolean): Promise<{ result: Result | undefined; logs: string[]; frames: number }> {
  let now = 0, seq = 0, frames = 0;
  const q: { at: number; fn: (t: number) => void; seq: number }[] = [];
  const push = (at: number, fn: (t: number) => void) => { q.push({ at, fn, seq: seq++ }); };
  const logs: string[] = [];
  const scroller = {
    tagName: "DIV", className: "relative z-10 h-full overflow-y-auto", _ov: "auto",
    scrollHeight: 21063, clientHeight: 811, scrollTop: 0,
    querySelectorAll: () => ({ length: 546 }),
    dispatchEvent: () => { now += 3; return true; }, // 휠 핸들러가 3ms 쓴다고 가정
    parentElement: null as unknown,
  };
  const grid = { tagName: "DIV", _ov: "visible", scrollHeight: 0, clientHeight: 0,
    querySelectorAll: () => ({ length: 546 }), parentElement: scroller };

  const sandbox: Record<string, unknown> = {
    console: { log: (...a: unknown[]) => logs.push(a.map(String).join(" ")), table: () => {} },
    document: { visibilityState: visible ? "visible" : "hidden",
      querySelector: (s: string) => (s === '[role="grid"]' ? grid : s.includes("_next") ? {} : null),
      scrollingElement: scroller },
    getComputedStyle: (e: { _ov: string }) => ({ overflowY: e._ov }),
    requestAnimationFrame: (fn: (t: number) => void) => { frames++; push(Math.ceil(now / FRAME) * FRAME + FRAME, fn); return seq; },
    setTimeout: (fn: () => void, ms?: number) => { push(now + (ms ?? 0), fn as (t: number) => void); return seq; },
    performance: { now: () => now },
    WheelEvent: class { constructor(t: string, i: Record<string, unknown>) { Object.assign(this, i); } },
    innerWidth: 1920, innerHeight: 900, devicePixelRatio: 1,
    navigator: { hardwareConcurrency: 24, deviceMemory: 32, userAgent: "Mozilla Chrome/153.0.0.0 Safari" },
    location: { origin: "http://localhost:3008", pathname: "/" },
    Date, JSON, Math, Object, Promise, Array, String, Number,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  let done = false, result: Result | undefined;
  (vm.runInContext(SRC, sandbox) as Promise<Result>).then((r) => { done = true; result = r; });

  // 가장 이른 콜백으로 시계를 옮기며 실행. 매 회 마이크로태스크를 비운다.
  for (let i = 0; i < 200_000 && !done; i++) {
    if (!q.length) { await new Promise((r) => setImmediate(r)); if (!q.length) break; continue; }
    q.sort((a, b) => a.at - b.at || a.seq - b.seq);
    const t = q.shift()!;
    now = Math.max(now, t.at);
    t.fn(now);
    await new Promise((r) => setImmediate(r));
  }
  return { result, logs, frames };
}

describe("숨은 탭이면 즉시 거부한다", () => {
  /**
   * 이 가드가 없으면 rAF를 기다리다 렌더러가 멎는다 — 실제로 45초 타임아웃을 봤다(2026-09-20).
   * 대표가 콘솔에 붙여넣었을 때 먹통이 되는 것보다 한 줄 설명이 낫다.
   */
  it("측정을 시작하지 않고 이유를 말한다", async () => {
    const { result, logs, frames } = await run(false);
    expect(result).toBeUndefined();
    expect(frames, "rAF를 한 번도 부르지 않아야 한다").toBe(0);
    expect(logs.join(" ")).toContain("보이는 상태가 아닙니다");
  });
});

describe("보이는 탭에서는 세 구간을 모두 잰다", () => {
  it("기준선·확대축소·스크롤 표본이 모두 모인다", async () => {
    const { result } = await run(true);
    expect(result, "측정이 끝까지 가지 못했다").toBeDefined();
    expect(result!.기준선_가만히.표본).toBeGreaterThan(30); // 1초 × 60Hz
    expect(result!.확대축소_40회.표본).toBeGreaterThan(0);
    expect(result!.스크롤_50프레임.표본).toBeGreaterThan(0);
  });

  it("60Hz 세상에서 기준선 중앙값은 16.7ms다 — 계산이 맞다는 뜻이다", async () => {
    const { result } = await run(true);
    expect(result!.기준선_가만히.중앙값).toBeCloseTo(16.7, 0);
  });

  it("초과 프레임을 실제로 센다", async () => {
    const { result } = await run(true);
    for (const k of ["기준선_가만히", "확대축소_40회", "스크롤_50프레임"] as const) {
      expect(typeof result![k]["33ms초과"], k).toBe("number");
      expect(typeof result![k]["50ms초과"], k).toBe("number");
    }
  });

  it("환경을 함께 적는다 — 어느 기기의 수치인지 없으면 숫자가 무의미하다", async () => {
    const { result } = await run(true);
    for (const k of ["화면", "dpr", "코어", "그리드DOM노드", "브라우저"]) {
      expect(result!.환경[k], k).toBeDefined();
    }
  });
});
