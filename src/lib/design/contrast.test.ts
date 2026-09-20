import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 대비 계약. 팔레트를 손볼 때 AA가 조용히 깨지는 것을 막는다.
 *
 * 왜 필요했나: `--ink-500`의 "흰 바탕 4.62:1"은 참이지만, 그 글자는 상세 패널 발처럼
 * **가라앉은 면**(ink-50)에도 올라간다. 거기서는 4.43으로 떨어졌고 브라우저 실측에서야
 * 잡혔다. 값 하나에 표면 하나만 따져 둔 주석은 계약이 아니다 — 쓰이는 표면 전부와
 * 짝지어 계산해야 계약이 된다.
 *
 * 어느 짝을 검사하는가는 **컴포넌트가 실제로 만드는 조합**이다. 여기 없는 조합이
 * 화면에 생기면 이 테스트는 통과하면서 화면이 실패한다 — 그래서 표면·글자 토큰을
 * 새로 만들 때 이 표에 줄을 더하는 것이 같은 작업의 일부다.
 */
const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

/**
 * globals.css `[1]` 원시에서 hex를 읽는다. 값의 원본이 한 곳이라는 뜻이다.
 * 정규식을 쓰지 않는다 — 이 파일은 토큰 이름만 찾으면 되고, 줄 단위 파싱이
 * 읽기도 쉽고 셸·heredoc을 거칠 때 이스케이프가 접히는 사고도 없다.
 */
function primitive(name: string): [number, number, number] {
  const head = `--${name}:`;
  const line = css
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(head));
  if (!line) throw new Error(`--${name} 원시를 globals.css에서 찾지 못했다`);
  const value = line.slice(head.length).split(";")[0]!.trim();
  if (!value.startsWith("#")) throw new Error(`--${name}은 hex가 아니다: ${value}`);
  const hex = value.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (full.length !== 6) throw new Error(`--${name} hex 길이가 이상하다: ${value}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** 역할 토큰이 어느 원시를 받는지 — `[2]`의 대입을 그대로 읽는다. */
function assigned(role: string): string {
  const head = `--color-${role}:`;
  const line = css
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(head));
  if (!line) throw new Error(`--color-${role} 역할 토큰이 없다`);
  const value = line.slice(head.length).split(";")[0]!.trim();
  const inner = value.startsWith("var(--") ? value.slice("var(--".length, -1) : "";
  if (!inner) throw new Error(`--color-${role}이 원시를 var()로 받지 않는다: ${value}`);
  return inner;
}

/**
 * `[3]` 다크 블록의 대입만 읽는다. `assigned()`는 파일 앞쪽(=라이트)을 먼저 만나므로
 * 다크를 확인하려면 범위를 잘라야 한다. 두 다크 블록(시스템·명시)이 **같은 목록**을
 * 들고 있는지도 여기서 본다 — 한쪽만 고치면 조용히 갈라진다.
 */
function darkBlocks(): Array<Map<string, string>> {
  const out: Array<Map<string, string>> = [];
  for (const head of ["@media (prefers-color-scheme: dark)", ':root[data-theme="dark"]']) {
    const at = css.indexOf(head);
    if (at < 0) throw new Error(`다크 블록을 찾지 못했다: ${head}`);
    // 그 헤더부터 블록을 닫는 `color-scheme: dark;`까지가 그 블록의 선언이다
    const rest = css.slice(at + head.length);
    const end = rest.indexOf("color-scheme: dark;");
    if (end < 0) throw new Error(`${head} 블록이 color-scheme으로 닫히지 않는다`);
    const body = rest.slice(0, end);
    const m = new Map<string, string>();
    for (const line of body.split("\n").map((l) => l.trim())) {
      if (!line.startsWith("--color-") && !line.startsWith("--shadow-")) continue;
      const [name, ...rest2] = line.split(":");
      const value = rest2.join(":").split(";")[0]!.trim();
      m.set(name!.trim().replace(/^--/, ""), value);
    }
    out.push(m);
  }
  return out;
}

/** 다크에서 이 역할이 받는 **원시 이름**. var(--x) 꼴이 아니면 던진다. */
function darkPrimitive(role: string): string {
  const value = darkBlocks()[0]!.get(`color-${role}`);
  if (!value) throw new Error(`다크에 --color-${role} 대입이 없다`);
  const inner = value.startsWith("var(--") ? value.slice("var(--".length, -1) : "";
  if (!inner) throw new Error(`--color-${role}이 원시를 var()로 받지 않는다: ${value}`);
  return inner;
}

/** WCAG 2.x 상대 휘도. sRGB 가정 — 원시가 전부 hex라서 성립한다. */
const luminance = ([r, g, b]: [number, number, number]) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (fg: string, bg: string) => {
  const a = luminance(primitive(fg));
  const b = luminance(primitive(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** 표면 역할 → 원시. 아래 첫 절이 `[2]`의 실제 대입과 같은지 확인한다. */
const SURFACE = {
  surface: "ink-0",
  "surface-sunken": "ink-50",
  canvas: "ink-100",
} as const;

/** 글자 역할 → 원시. */
const TEXT = {
  fg: "ink-900",
  "fg-strong": "ink-700",
  "fg-muted": "ink-600",
  "fg-subtle": "ink-500",
} as const;

describe("역할 ↔ 원시 대입이 이 표와 같다", () => {
  it.each([...Object.entries(SURFACE), ...Object.entries(TEXT)])(
    "--color-%s = var(--%s)",
    (role, prim) => {
      expect(assigned(role)).toBe(prim);
    },
  );
});

describe("본문 4.5:1 — 실제로 쓰이는 글자·표면 짝", () => {
  /**
   * 네 글자 단계가 **흰 면과 가라앉은 면 둘 다**에서 통과해야 한다. 후자가 빠져 있어서
   * 상세 패널 발의 출처 줄이 4.43으로 실패했다(2026-09-12 실측).
   * 캔버스(ink-100)는 카드 프레임이 덮으므로 글자가 직접 놓이지 않는다 — 아래
   * "장식" 절에서 통과를 요구하지 않고 관계만 고정한다.
   */
  const pairs = (["surface", "surface-sunken"] as const).flatMap((bg) =>
    (Object.keys(TEXT) as Array<keyof typeof TEXT>).map((fg) => [fg, bg] as const),
  );

  it.each(pairs)("%s on %s >= 4.5", (fg, bg) => {
    expect(ratio(TEXT[fg], SURFACE[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("열 5색은 흰 바탕에서 AA를 넘는다 — 열 이름·3px 밑선·관점별 명칭에 쓴다(ai는 나라가 아니다)", () => {
    for (const r of ["kr", "cn", "jp", "ai", "us"]) {
      expect(ratio(`region-${r}`, "ink-0")).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("[3] 다크 — 라이트와 같은 계약을 받는다", () => {
  it("두 다크 블록(시스템·명시)이 같은 이름에 같은 값을 대입한다", () => {
    const [sys, explicit] = darkBlocks();
    expect([...explicit!.keys()].sort()).toEqual([...sys!.keys()].sort());
    for (const [k, v] of sys!) expect(explicit!.get(k)).toBe(v);
  });

  it("라이트에 있는 역할은 다크에도 전부 있다 — 하나라도 빠지면 그 토큰만 라이트로 남는다", () => {
    const light = new Set(
      css.slice(css.indexOf("@theme"), css.indexOf("@media (prefers-color-scheme: dark)"))
        .split("\n").map((l) => l.trim())
        .filter((l) => l.startsWith("--color-"))
        .map((l) => l.slice(2).split(":")[0]!.trim()),
    );
    const dark = new Set(darkBlocks()[0]!.keys());
    const missing = [...light].filter((k) => !dark.has(k));
    expect(missing).toEqual([]);
  });

  const pairs = (["surface", "surface-sunken"] as const).flatMap((bg) =>
    (Object.keys(TEXT) as Array<keyof typeof TEXT>).map((fg) => [fg, bg] as const),
  );

  it.each(pairs)("다크 %s on %s >= 4.5", (fg, bg) => {
    const a = luminance(primitive(darkPrimitive(fg)));
    const b = luminance(primitive(darkPrimitive(bg)));
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("다크에서도 열 5색이 표면 위 AA를 넘는다 — 흰 바탕용 값을 그대로 쓰면 안 보인다", () => {
    const bg = luminance(primitive(darkPrimitive("surface")));
    for (const r of ["kr", "cn", "jp", "ai", "us"]) {
      const a = luminance(primitive(darkPrimitive(`region-${r}`)));
      expect((Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("다크에서도 fg-decorative는 글자 기준에 못 미친다 — 이름이 곧 금지다", () => {
    const a = luminance(primitive(darkPrimitive("fg-decorative")));
    const bg = luminance(primitive(darkPrimitive("surface")));
    expect((Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05)).toBeLessThan(4.5);
  });

  it("역상 한 쌍이 뒤집힌다 — 라이트의 '검은 알약에 흰 글씨'가 다크에서는 그 반대다", () => {
    const surf = luminance(primitive(darkPrimitive("surface-inverse")));
    const fg = luminance(primitive(darkPrimitive("fg-inverse")));
    expect(surf).toBeGreaterThan(fg); // 다크에서는 역상 표면이 더 밝다
    expect(luminance(primitive(assigned("surface-inverse")))).toBeLessThan(luminance(primitive(assigned("fg-inverse"))));
    expect((Math.max(surf, fg) + 0.05) / (Math.min(surf, fg) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("그림자는 다크에서 값이 바뀐다 — 검은 그림자는 어두운 면에서 보이지 않는다", () => {
    const dark = darkBlocks()[0]!;
    for (const k of ["shadow-float", "shadow-sheet"]) {
      expect(dark.get(k)).toBeDefined();
      expect(dark.get(k)).toContain("255 255 255"); // 테두리 한 겹이 들어간다
    }
  });
});

describe("장식 전용 토큰은 글자 기준을 넘지 않는다 — 이름이 용도를 강제한다", () => {
  it("ink-450은 흰 바탕에서 4.5:1에 못 미친다(그래서 fg-decorative다)", () => {
    expect(ratio("ink-450", "ink-0")).toBeLessThan(4.5);
    expect(assigned("fg-decorative")).toBe("ink-450");
  });

  it("가라앉은 면·캔버스는 흰 면보다 어둡다 — 순서가 뒤집히면 위 짝의 전제가 깨진다", () => {
    expect(luminance(primitive("ink-0"))).toBeGreaterThan(luminance(primitive("ink-50")));
    expect(luminance(primitive("ink-50"))).toBeGreaterThan(luminance(primitive("ink-100")));
  });
});
