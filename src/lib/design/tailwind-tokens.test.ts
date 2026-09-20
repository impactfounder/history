import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **소스가 부르는 유틸리티 이름이 globals.css에 실재하는가.**
 *
 * Tailwind v4는 `@theme`의 토큰에서 유틸리티를 만든다. 토큰이 없으면 클래스도 **만들어지지 않고**,
 * 그 `className`은 조용히 아무 일도 하지 않는다 — 빌드도 tsc도 통과한다.
 *
 * 실제로 그렇게 나가고 있었다(2026-09-20 발견): `TimelineGrid.tsx:1028`의 기간 프레임이
 * `rounded-chip`을 쓰는데 `--radius-chip` 토큰이 없어, 빌드 산출 CSS에 `.rounded-card`·
 * `.rounded-item`은 있고 **`.rounded-chip`만 없었다.** 프레임이 각진 채 배포되고 있었다.
 * 설계 원본(`docs/globals.tokens.css`)에도 반경은 card·item 둘뿐이라 처음부터 오타였다.
 *
 * AGENTS.md가 같은 부류를 이미 한 번 경고했다 — "리터럴 이름이 소스에 없으면 Tailwind v4가
 * `@theme`의 '미사용' 토큰을 트리셰이킹으로 지운다. 실제로 한 번 지워져 나라 이름 색이
 * 배포본에서 죽어 있었다." 그쪽은 **토큰이 사라지는** 방향이고 이쪽은 **이름이 없는** 방향인데,
 * 둘 다 증상이 "화면만 조용히 틀린다"로 같다.
 */
const root = path.join(__dirname, "../../..");
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

/** 소스 전체를 한 덩어리로 — 어느 파일인지보다 "쓰였는가"가 계약이다. */
const sources = (() => {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push({ file: path.relative(root, p).split(path.sep).join("/"), text: readFileSync(p, "utf8") });
      }
    }
  };
  walk(path.join(root, "src"));
  return out;
})();

const hasToken = (name: string) => new RegExp(String.raw`^\s*--${name}:`, "m").test(css);

/** Tailwind가 기본으로 주는 이름 — 토큰이 없어도 된다. */
const BUILTIN_RADIUS = new Set(["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]);
const BUILTIN_TEXT = new Set(["left", "center", "right", "justify", "start", "end", "wrap", "nowrap", "balance", "pretty"]);

describe("rounded-* 는 --radius-* 토큰이 있어야 한다", () => {
  /** `rounded-card` · `rounded-t-card` 둘 다 `--radius-card`를 쓴다. 변(t/b/l/r/tl…)은 떼고 본다. */
  const used = new Map<string, string>(); // 이름 → 처음 쓴 파일
  for (const { file, text } of sources) {
    for (const m of text.matchAll(/\brounded-(?:[trbl]{1,2}-)?([a-z0-9][a-z0-9-]*)\b/g)) {
      if (!used.has(m[1]!)) used.set(m[1]!, file);
    }
  }

  it("이름을 하나 이상 찾았다 — 정규식이 헛돌면 아래가 무의미하다", () => {
    expect(used.size).toBeGreaterThan(0);
  });

  it.each([...used].map(([n, f]) => [n, f] as const))("rounded-%s (%s)", (name, file) => {
    if (BUILTIN_RADIUS.has(name)) return;
    expect(
      hasToken(`radius-${name}`),
      `globals.css에 --radius-${name}이 없다 — ${file}의 rounded-${name}은 클래스가 만들어지지 않아 아무 일도 하지 않는다`,
    ).toBe(true);
  });
});

describe("text-* 는 --text-* 또는 --color-* 토큰이 있어야 한다", () => {
  const used = new Map<string, string>();
  for (const { file, text } of sources) {
    for (const m of text.matchAll(/\btext-([a-z][a-z0-9-]*)\b/g)) {
      if (!used.has(m[1]!)) used.set(m[1]!, file);
    }
  }

  it("이름을 하나 이상 찾았다", () => {
    expect(used.size).toBeGreaterThan(0);
  });

  it.each([...used].map(([n, f]) => [n, f] as const))("text-%s (%s)", (name, file) => {
    if (BUILTIN_TEXT.has(name)) return;
    const ok = hasToken(`text-${name}`) || hasToken(`color-${name}`);
    expect(
      ok,
      `globals.css에 --text-${name}도 --color-${name}도 없다 — ${file}의 text-${name}은 아무 일도 하지 않는다`,
    ).toBe(true);
  });
});

describe("임의값이 이미 있는 토큰을 베끼지 않는다", () => {
  /**
   * `text-[13px]`가 `--text-item: 13px`와 같은 값이었다(`TimelineGrid.tsx:765`). 토큰 층이 있는
   * 이유가 "한 곳만 고치면 된다"인데 임의값 사본이 있으면 그 약속이 깨진다.
   *
   * 값이 **어떤 토큰과도 다른** 임의값은 막지 않는다 — 국기 모서리 `rounded-[2px]`처럼 토큰을
   * 만들 만큼 되풀이되지 않는 것까지 금지하면 규칙이 과해진다.
   */
  /**
   * **같은 계열끼리만 견준다.** 값만 보고 계열을 넘으면 오탐이 난다 — 처음 쓴 판이 국기 모서리
   * `rounded-[2px]`를 여백 토큰 `--size-cell-pad: 2px`에 물렸다. 2px가 같을 뿐 반경과 여백은
   * 다른 것이고, 그 제안을 따르면 코드가 더 나빠진다.
   */
  const family: Record<"text" | "rounded", string> = { text: "text", rounded: "radius" };
  const tokenValues = new Map<string, Map<string, string>>(); // "radius" → ("6px" → "--radius-item")
  for (const m of css.matchAll(/^[ \t]*--(text|radius)-([a-z0-9-]+):[ \t]*([^;]+);/gm)) {
    const kind = m[1]!;
    if (m[2]!.includes("--line-height")) continue;
    if (!tokenValues.has(kind)) tokenValues.set(kind, new Map());
    tokenValues.get(kind)!.set(m[3]!.trim(), `--${kind}-${m[2]}`);
  }

  const arbitrary: { file: string; cls: string; kind: string; value: string }[] = [];
  for (const { file, text } of sources) {
    for (const m of text.matchAll(/((text|rounded)-\[([^\]]+)\])/g)) {
      arbitrary.push({ file, cls: m[1]!, kind: family[m[2]! as "text" | "rounded"], value: m[3]! });
    }
  }

  it("계열별 토큰 표를 읽었다", () => {
    expect(tokenValues.get("text")?.size).toBeGreaterThan(0);
    expect(tokenValues.get("radius")?.size).toBeGreaterThan(0);
  });

  it("같은 계열에 같은 값의 토큰이 있는데 임의값을 쓴 곳이 없다", () => {
    const dupes = arbitrary
      .filter((a) => tokenValues.get(a.kind)?.has(a.value))
      .map((a) => `${a.file}: ${a.cls} → ${tokenValues.get(a.kind)!.get(a.value)} 를 써라`);
    expect(dupes).toEqual([]);
  });
});
