import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **「원문 EN」 태그는 진짜 원문에만 붙어야 한다.**
 *
 * 그 태그(`originalTag`)와 회색 13px(`plain`)은 "이 칩은 아직 우리 말로 옮기지 못한 원문"이라는
 * 뜻이고, 1b 설계가 **데이터 품질의 계기판**으로 쓰기로 한 채널이다 —
 * "번역이 채워지면 plain이 저절로 lead로 올라간다".
 *
 * 그런데 계기판의 바늘이 통째로 거짓이었다(대표 지적 2026-09-20: "원문 en 이런 건 왜 있는 거야?").
 * 실측: 한국어 UI에서 plain으로 떨어진 **723건이 100% 한글 제목**이었다.
 *
 * ```
 * [kr] 1950 lang=en  인천 상륙 작전
 * [kr] 1994 lang=en  고난의 행군
 * [kr] 1592 lang=en  부산진 전투
 * [us] 2019 lang=en  코로나19 범유행
 * ```
 *
 * 원인은 `derive.mjs`가 **출처 URL에서 언어를 뽑는 것**이었다(`ko.wikipedia.org` → ko).
 * 위키데이터 행의 URL은 `www.wikidata.org`라 정규식이 맞지 않아 `"en"`으로 떨어졌는데,
 * 본문은 `sl.ko ?? sl.en`이라 **한국어 사이트링크**였다. 그래서 한국 열의 대표 사건들이
 * "건너뛰어도 되는 것"으로 칠해지고 있었다.
 *
 * 고친 뒤 이 오탐은 **0건**이다. 계기판이 0을 가리키는 것이 지금은 사실이다.
 */
const DATA = path.join(__dirname, "../../public/data/v1");
const published = existsSync(path.join(DATA, "manifest.json"));

/** 발행 산출물은 git에 없다(prebuild가 만든다). */
describe.skipIf(!published)("원문 태그는 진짜 원문에만", () => {
  const all = (() => {
    const seen = new Map<string, Record<string, unknown>>();
    for (const region of readdirSync(path.join(DATA, "events"))) {
      const dir = path.join(DATA, "events", region);
      if (region === "detail" || !statSync(dir).isDirectory()) continue;
      const walk = (d: string) => {
        for (const name of readdirSync(d)) {
          const p = path.join(d, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name.endsWith(".json")) {
            for (const ev of JSON.parse(readFileSync(p, "utf8")).events ?? []) seen.set(ev.id, { ...ev, _r: region });
          }
        }
      };
      walk(dir);
    }
    return [...seen.values()];
  })();

  it("사건을 읽었다 — 0이면 아래가 무의미하다", () => {
    expect(all.length).toBeGreaterThan(1000);
  });

  /**
   * `itemKind`의 ko 분기를 그대로 재현한다: 이름도 없고 · 언어도 ko가 아니고 · 한국어 옮김도 없으면
   * plain이고 `[ev.lang]` 태그가 붙는다(`src/lib/timeline/item-kind.ts`).
   */
  const plainInKo = all.filter((e) => !e.name_ko && e.lang !== "ko" && !e.title_ko);
  const hangul = (s: unknown) => /[가-힣]/.test(String(s ?? ""));

  it("한글 제목에 외국어 원문 태그가 붙지 않는다", () => {
    const wrong = plainInKo
      .filter((e) => hangul(e.title))
      .slice(0, 8)
      .map((e) => `[${e._r}] ${e.y0} lang=${e.lang} — ${String(e.title).slice(0, 40)}`);
    expect(wrong, "이 칩들은 이미 한국어인데 「원문」으로 칠해진다").toEqual([]);
  });

  /**
   * 뒤집힌 쪽도 본다 — `lang: "ko"`인데 한글이 한 자도 없으면 그 줄은 옮겨진 척하고 있다.
   * (한자 표기만 있는 제목이 있을 수 있어 **한자도 한글도 없는** 경우만 잡는다.)
   */
  it("ko로 표시됐는데 한글도 한자도 없는 제목이 없다", () => {
    const suspicious = all
      .filter((e) => e.lang === "ko" && !hangul(e.title) && !/[一-鿿]/.test(String(e.title ?? "")))
      .slice(0, 8)
      .map((e) => `[${e._r}] ${e.y0} — ${String(e.title).slice(0, 40)}`);
    expect(suspicious).toEqual([]);
  });
});
