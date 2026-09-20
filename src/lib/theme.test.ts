import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { THEMES, THEME_KEY, THEME_SCRIPT, isTheme, themeAttr } from "./theme";

/**
 * 테마의 계약은 **CSS와 스크립트와 상수 셋이 같은 말을 하는가**이다. 어긋나면 증상이 조용하다:
 * 첫 페인트만 틀리고 그 뒤 토글은 맞아서 "새로고침하면 잠깐 반대 색"으로만 보인다.
 */
const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

describe("세 상태 — 「시스템」은 값이 없는 것이 아니라 상태 하나다", () => {
  it("상태는 셋이고 기본은 system이다", () => {
    expect([...THEMES]).toEqual(["system", "light", "dark"]);
  });

  it("system은 속성을 **지운다** — 그것이 시스템으로 돌아가는 유일한 길이다", () => {
    expect(themeAttr("system")).toBeNull();
    expect(themeAttr("light")).toBe("light");
    expect(themeAttr("dark")).toBe("dark");
  });

  it("모르는 값은 테마가 아니다 — localStorage는 아무 문자열이나 들고 있을 수 있다", () => {
    for (const v of ["", "Dark", "auto", null, undefined, 1, {}]) expect(isTheme(v)).toBe(false);
    for (const v of THEMES) expect(isTheme(v)).toBe(true);
  });
});

describe("globals.css가 이 세 상태를 실제로 구현한다", () => {
  /**
   * 이 두 줄이 [3] 블록의 전부다. 하나라도 이름이 바뀌면 토글이 아무것도 하지 않는데
   * 화면에는 에러가 없다.
   */
  it("시스템 다크는 light 선택에 눌린다", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(`:root:not([data-theme="light"])`);
  });

  it("명시적 dark 선택이 따로 있다", () => {
    expect(css).toContain(`:root[data-theme="dark"]`);
  });

  /**
   * `<html data-theme="light">`를 기본값으로 박으면 시스템 다크를 따르는 길이 사라진다.
   * Next 문서의 예제가 그렇게 하므로(그쪽 CSS는 두 상태뿐이다) 베껴 오기 쉽다.
   */
  it("레이아웃이 data-theme을 기본값으로 박아 두지 않는다", () => {
    for (const f of ["../app/(ko)/layout.tsx", "../app/(intl)/[locale]/layout.tsx"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/<html[^>]*data-theme=/);
    }
  });
});

describe("첫 페인트 스크립트가 상수와 어긋나지 않는다", () => {
  it("같은 localStorage 키를 읽는다", () => {
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_KEY));
  });

  it("속성을 붙이는 값은 light·dark 둘뿐이다 — system은 아무것도 하지 않는다", () => {
    expect(THEME_SCRIPT).toContain(`t==="dark"`);
    expect(THEME_SCRIPT).toContain(`t==="light"`);
    expect(THEME_SCRIPT).not.toContain("system");
  });

  it("localStorage를 못 읽어도 페이지가 죽지 않는다", () => {
    expect(THEME_SCRIPT).toContain("try{");
    expect(THEME_SCRIPT).toContain("catch(e){}");
  });

  /** 실제로 돌려 본다 — 문자열만 보면 문법이 깨져도 통과한다. */
  it.each([
    ["dark", "dark"],
    ["light", "light"],
    ["system", null],
    ["", null],
    ["Dark", null],
    [null, null],
  ])("저장값 %s → data-theme %s", (stored, expected) => {
    const attrs = new Map<string, string>();
    const documentElement = {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
    };
    new Function("localStorage", "document", THEME_SCRIPT)(
      { getItem: () => stored },
      { documentElement },
    );
    expect(attrs.get("data-theme") ?? null).toBe(expected);
  });

  it("localStorage가 던져도 삼킨다 — 사생활 보호 모드", () => {
    const attrs = new Map<string, string>();
    expect(() =>
      new Function("localStorage", "document", THEME_SCRIPT)(
        { getItem: () => { throw new Error("blocked"); } },
        { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: () => {} } },
      ),
    ).not.toThrow();
    expect(attrs.size).toBe(0);
  });
});

describe("네 언어 모두 이름을 가진다", () => {
  it("빠진 locale이 없다", async () => {
    const { T, LOCALES } = await import("./i18n");
    for (const l of LOCALES) {
      const t = T[l];
      expect(t.theme, l).toBeTruthy();
      for (const s of THEMES) expect(t.themeName[s], `${l}.${s}`).toBeTruthy();
      expect(t.themeNext(t.themeName.dark), l).toContain(t.themeName.dark);
    }
  });
});

/**
 * 조사 — 「시스템로 바꾸기」가 브라우저에서 잡혔다(2026-09-20). 상태 이름이 늘거나 바뀌면
 * 또 틀릴 자리라 규칙으로 고정한다.
 */
describe("로 / 으로", () => {
  it.each([
    ["시스템", "시스템으로"],
    ["밝게", "밝게로"],
    ["어둡게", "어둡게로"],
    ["서울", "서울로"], // ㄹ 받침은 「로」다
    ["한국", "한국으로"],
    ["AI", "AI로"], // 한글이 아니면 규칙 밖 — 그냥 「로」
    ["", "로"],
  ])("%s → %s", async (w, expected) => {
    const { euro } = await import("./i18n");
    expect(w + euro(w)).toBe(expected);
  });

  it("한국어 themeNext가 세 이름 모두에서 맞는 조사를 쓴다", async () => {
    const { T } = await import("./i18n");
    const t = T.ko;
    expect(t.themeNext(t.themeName.system)).toBe("시스템으로 바꾸기");
    expect(t.themeNext(t.themeName.light)).toBe("밝게로 바꾸기");
    expect(t.themeNext(t.themeName.dark)).toBe("어둡게로 바꾸기");
  });
});
