import { describe, expect, it } from "vitest";

import { itemKind, originalTag, type KindSource } from "./item-kind";

/**
 * 1b의 2단 위계 — 등급의 축이 중요도가 아니라 **UI 언어로 읽히는가**다.
 * 실측 근거: 십년 레벨 착지 화면 48건 중 15건(31%)이 한국어 UI인데 영·중 원문이었고,
 * 그 15건이 지저분함의 가장 큰 단일 원인이었다(README §4).
 */

/** 최소 필드만 채운 사건. names는 열(kr/cn/jp/us)별 표제어다. */
const ev = (o: Partial<KindSource>): KindSource => ({ title: "", lang: "en", names: {}, ...o });

describe("itemKind — 사건 이름 표제어", () => {
  it("한국어 표제어가 사건 이름 꼴이면 lead", () => {
    expect(itemKind(ev({ title: "…", lang: "en", names: { kr: { nat: "임진왜란" } } }), "ko")).toBe("lead");
  });

  it("영어 UI에서 영어 표제어가 사건 이름 꼴이면 lead", () => {
    expect(itemKind(ev({ title: "…", lang: "ko", names: { us: { nat: "Imjin War" } } }), "en")).toBe("lead");
  });

  it("재위 시작(accession)은 인물 이름이라도 lead — eventLabel이 「… 즉위」를 만든다", () => {
    expect(itemKind(ev({ title: "Sejong", lang: "en", role: "accession", names: { kr: { nat: "세종" } } }), "ko")).toBe("lead");
  });
});

describe("itemKind — 인물·지명 표제어는 lead가 아니다", () => {
  it("인물 이름 표제어는 plain으로 떨어진다", () => {
    // eventLabel이 이름으로 쓰지 않으므로(「이시진 · March — …」는 정보가 안 된다) 원문이 남는다
    expect(itemKind(ev({ title: "Li Shizhen compiles…", lang: "en", names: { kr: { nat: "이시진" } } }), "ko")).toBe("plain");
  });

  it("지명 표제어도 plain", () => {
    expect(itemKind(ev({ title: "March — According to…", lang: "en", names: { kr: { nat: "기이반도" } } }), "ko")).toBe("plain");
  });
});

describe("itemKind — 원문 언어", () => {
  it("ko 원문은 표제어가 없어도 lead — 이미 읽힌다", () => {
    expect(itemKind(ev({ title: "9월 18일 남북한이 유엔(UN) 동시 가입", lang: "ko" }), "ko")).toBe("lead");
  });

  it("en 원문은 한국어 UI에서 plain", () => {
    expect(itemKind(ev({ title: "August. The Axe Murder Incident in Panmunjom", lang: "en" }), "ko")).toBe("plain");
  });

  it("zh 원문은 한국어 UI에서 plain", () => {
    expect(itemKind(ev({ title: "月19日，中国国务院总理赵紫阳…", lang: "zh" }), "ko")).toBe("plain");
  });

  it("같은 원문이 그 언어 UI에서는 lead가 된다", () => {
    const e = ev({ title: "月19日，中国国务院总理赵紫阳…", lang: "zh" });
    expect(itemKind(e, "ko")).toBe("plain");
    expect(itemKind(e, "zh")).toBe("lead");
  });
});

describe("itemKind — 기계 번역", () => {
  it("ko UI에 title_ko가 있으면 en 원문도 lead로 올라간다", () => {
    expect(itemKind(ev({ title: "The Cold War ends…", lang: "en", title_ko: "냉전이 끝나다" }), "ko")).toBe("lead");
  });

  it("title_ko는 ko UI에만 적용된다 — ja UI에서는 여전히 plain", () => {
    expect(itemKind(ev({ title: "The Cold War ends…", lang: "en", title_ko: "냉전이 끝나다" }), "ja")).toBe("plain");
  });

  it("번역이 채워지면 plain이 저절로 lead로 올라간다 — 디자인이 데이터 품질의 계기판", () => {
    const before = ev({ title: "One Belt, One Road was proposed…", lang: "en" });
    expect(itemKind(before, "ko")).toBe("plain");
    expect(itemKind({ ...before, title_ko: "일대일로 구상 제안" }, "ko")).toBe("lead");
  });
});

describe("originalTag — plain에만 붙는 언어 태그", () => {
  it("plain에는 대문자 언어 코드가 붙는다", () => {
    expect(originalTag(ev({ title: "…", lang: "en" }), "ko")).toBe("EN");
    expect(originalTag(ev({ title: "…", lang: "zh" }), "ko")).toBe("ZH");
  });

  it("lead에는 붙지 않는다 — 읽히는 것에 태그를 붙이면 소음이다", () => {
    expect(originalTag(ev({ title: "…", lang: "ko" }), "ko")).toBeUndefined();
    expect(originalTag(ev({ title: "…", lang: "en", names: { kr: { nat: "임진왜란" } } }), "ko")).toBeUndefined();
  });
});
