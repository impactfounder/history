import { describe, expect, it } from "vitest";
import { eventLabel, formatRowLabelL, formatYearL, isEventName, type LabelSource } from "./i18n";

describe("formatYearL / formatRowLabelL", () => {
  it("연도를 언어 관용대로", () => {
    expect(formatYearL(1882, "ko")).toBe("1882년");
    expect(formatYearL(1882, "en")).toBe("1882");
    expect(formatYearL(-56, "ko")).toBe("기원전 57년"); // 천문학적 -56 = BC 57
    expect(formatYearL(-56, "en")).toBe("57 BC");
    expect(formatYearL(-56, "ja")).toBe("紀元前57年");
    expect(formatYearL(-56, "zh")).toBe("公元前57年");
  });
  it("행 라벨은 axis.ts와 같은 버킷 규칙", () => {
    expect(formatRowLabelL(1900, "decade", "ko")).toBe("1900년대");
    expect(formatRowLabelL(1900, "decade", "en")).toBe("1900s");
    expect(formatRowLabelL(1900, "decade", "ja")).toBe("1900年代");
    expect(formatRowLabelL(-500, "decade", "ko")).toBe("기원전 501–492년");
    expect(formatRowLabelL(-500, "decade", "en")).toBe("501–492 BC");
    expect(formatRowLabelL(0, "decade", "ko")).toBe("기원전 1년–서기 9년"); // 경계 버킷
    expect(formatRowLabelL(0, "decade", "en")).toBe("1 BC – AD 9");
    expect(formatRowLabelL(1882, "year", "zh")).toBe("1882年");
  });
});

describe("isEventName", () => {
  it("사건 이름 꼴만 참 — 인물·왕조·지명은 거짓", () => {
    expect(isEventName("임진왜란", "ko")).toBe(true);
    expect(isEventName("도요토미 히데요시", "ko")).toBe(false);
    expect(isEventName("청나라", "ko")).toBe(false);
    expect(isEventName("Battle of Sekigahara", "en")).toBe(true);
    expect(isEventName("Toyotomi Hideyoshi", "en")).toBe(false);
    expect(isEventName("関ヶ原の戦い", "ja")).toBe(true);
    expect(isEventName("萬曆朝鮮之役", "zh")).toBe(true);
    expect(isEventName("오승은 (명나라)", "ko")).toBe(false);
  });
});

describe("eventLabel", () => {
  const ev: LabelSource = {
    title: "1592: The Imjin War begins.",
    lang: "en",
    names: { kr: { nat: "임진왜란", lang: "ko" }, cn: { nat: "萬曆朝鮮之役", lang: "zh" }, jp: { nat: "文禄・慶長の役", lang: "ja" }, us: { nat: "Imjin War", lang: "en" } },
  };
  it("UI 언어의 사건 이름이 있으면 이름만", () => {
    expect(eventLabel(ev, "ko")).toEqual({ name: "임진왜란" });
    expect(eventLabel(ev, "ja")).toEqual({ name: "文禄・慶長の役" });
    expect(eventLabel(ev, "zh")).toEqual({ name: "萬曆朝鮮之役" });
  });
  it("영어 UI: 영어 사건 이름이 있으면 그것, 없으면 영어 원문 그대로", () => {
    expect(eventLabel(ev, "en")).toEqual({ name: "Imjin War" });
    const plain: LabelSource = { title: "Ohio becomes the 17th state", lang: "en", names: { us: { nat: "Ohio", lang: "en" } } };
    expect(eventLabel(plain, "en")).toEqual({ text: "Ohio becomes the 17th state" }); // 지명 표제어 + 원문이 영어 → 원문만
  });
  it("인물·지명 표제어는 붙이지 않는다 — 원문만", () => {
    const person: LabelSource = { title: "Li Shizhen published the Compendium of Materia Medica.", lang: "en", names: { kr: { nat: "이시진", lang: "ko" }, us: { nat: "Li Shizhen", lang: "en" } } };
    expect(eventLabel(person, "ko")).toEqual({ text: person.title });
    const place: LabelSource = { title: "March — According to the Japan Forestry Research…", lang: "en", names: { kr: { nat: "기이반도", lang: "ko" } } };
    expect(eventLabel(place, "ko")).toEqual({ text: place.title });
  });
  it("같은 셀에 같은 이름이 둘이면 원문으로", () => {
    expect(eventLabel(ev, "ko", new Set(["임진왜란"]))).toEqual({ text: ev.title });
  });
  it("한국어 원문의 묶인 줄은 '첫 사건 외 N'", () => {
    const bundled: LabelSource = { title: "조미수호조규 체결, 임오군란 일어남, 일본과 제물포조약 체결", lang: "ko", names: {} };
    expect(eventLabel(bundled, "ko")).toEqual({ text: "조미수호조규 체결 외 2" });
    expect(eventLabel(bundled, "en")).toEqual({ text: bundled.title }); // 영어 UI: 표제어 없으면 원문
  });
});
