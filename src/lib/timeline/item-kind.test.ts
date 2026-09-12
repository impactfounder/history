import { describe, expect, it } from "vitest";

import { eventLabel } from "@/lib/i18n";
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

describe("itemKind — 지은 제목(name_ko)", () => {
  it("지은 제목이 있으면 ko UI에서 lead — 문장 대신 이름이 보인다", () => {
    const sentence = "2월. 14개조 평화 원칙에서 제시된 민족자결주의에 영향을 받아, 일본에 있던 한국 독립운동가들이 2·8독립선언서를 발표하였다.";
    expect(itemKind(ev({ title: sentence, lang: "en", name_ko: "2·8 독립선언" }), "ko")).toBe("lead");
  });

  it("지은 제목은 ko UI에만 쓴다 — 다른 언어는 아직 안 지었으므로 원문 그대로", () => {
    expect(itemKind(ev({ title: "The Cold War ends.", lang: "en", name_ko: "냉전 종식" }), "ja")).toBe("plain");
  });

  it("원문 표제어가 사건 꼴이면 그쪽이 이긴다 — 진본이 파생물보다 앞선다", () => {
    const e = ev({ title: "…", lang: "en", names: { kr: { nat: "임진왜란" } }, name_ko: "조선 침공" });
    expect(eventLabel(e, "ko").name).toBe("임진왜란");
  });

  it("같은 칸에 같은 지은 제목이 둘이면 원문으로 되돌린다 — 「3·1 운동」이 세 번 찍히지 않게", () => {
    const e = ev({ title: "3월 — 3·1 운동이 시작되어 한국 독립운동을 고취시키다.", lang: "en", name_ko: "3·1 운동" });
    expect(eventLabel(e, "ko", new Set(["3·1 운동"])).name).toBeUndefined();
    expect(eventLabel(e, "ko", new Set(["3·1 운동"])).text).toBeDefined();
    // 겹치지 않으면 그대로 이름
    expect(eventLabel(e, "ko", new Set(["다른 이름"])).name).toBe("3·1 운동");
  });

  it("지은 제목에는 언어 태그를 붙이지 않는다 — 읽히는 것에 태그는 소음이다", () => {
    expect(originalTag(ev({ title: "A long English sentence…", lang: "en", name_ko: "냉전 종식" }), "ko")).toBeUndefined();
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
