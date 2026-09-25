import { describe, expect, it } from "vitest";
import { LOCALES, PREFIXED_LOCALES, REGION_LABEL, dropMonthPrefix, dropYearPrefix, eventLabel, formatRowLabelL, formatYearL, isEventName, localePath, trimLabelEnd, type LabelSource } from "./i18n";
import { YEAR } from "./i18n-pages";

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
    // 기원전 범위는 "년"을 뗀다 — 좁은 거터에서 줄이 감겨 다음 행과 겹쳤다
    expect(formatRowLabelL(-500, "decade", "ko")).toBe("기원전 501–492");
    expect(formatRowLabelL(-500, "decade", "en")).toBe("501–492 BC");
    expect(formatRowLabelL(0, "decade", "ko")).toBe("기원전 1–서기 9"); // 경계 버킷
    expect(formatRowLabelL(0, "decade", "en")).toBe("1 BC–AD 9");
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
    // 원문으로 떨어진다 — 끝 마침표만 다듬는다(trimLabelEnd)
    expect(eventLabel(person, "ko")).toEqual({ text: trimLabelEnd(person.title) });
    const place: LabelSource = { title: "March — According to the Japan Forestry Research…", lang: "en", names: { kr: { nat: "기이반도", lang: "ko" } } };
    expect(eventLabel(place, "ko")).toEqual({ text: place.title });
  });
  it("같은 셀에 같은 이름이 둘이면 원문으로", () => {
    expect(eventLabel(ev, "ko", new Set(["임진왜란"]))).toEqual({ text: trimLabelEnd(ev.title) });
  });
  it("한국어 원문의 묶인 줄은 '첫 사건 외 N'", () => {
    const bundled: LabelSource = { title: "조미수호조규 체결, 임오군란 일어남, 일본과 제물포조약 체결", lang: "ko", names: {} };
    expect(eventLabel(bundled, "ko")).toEqual({ text: "조미수호조규 체결 외 2" });
    expect(eventLabel(bundled, "en")).toEqual({ text: bundled.title }); // 영어 UI: 표제어 없으면 원문
  });
});

describe("localePath", () => {
  it("한국어는 접두 없이, 나머지는 로케일 세그먼트", () => {
    expect(localePath("ko", "/y/1592")).toBe("/y/1592");
    expect(localePath("en", "/y/1592")).toBe("/en/y/1592");
    expect(localePath("ja", "/sources")).toBe("/ja/sources");
    expect(localePath("zh", "/y/-56")).toBe("/zh/y/-56");
  });
  it("접두 목록에 한국어는 없다 — 루트가 한국어다", () => {
    expect(PREFIXED_LOCALES).toEqual(["en", "ja", "zh"]);
    expect(LOCALES.filter((l) => !PREFIXED_LOCALES.includes(l as never))).toEqual(["ko"]);
  });
});

/**
 * 열을 늘리면 **카피 네 벌이 같이 늘어야 한다.** AI 열을 넣을 때 ko만 고치고 en·ja·zh의
 * 연도 페이지 제목이 "Korea, China, Japan and the United States"로 남아 있었다(2026-09-20).
 * 타입은 통과한다 — 문자열이 있기는 하니까. 그래서 **내용**을 검사한다.
 */
describe("연도 페이지 카피가 모든 열을 나열한다", () => {
  const cols = Object.keys(REGION_LABEL.ko) as Array<keyof typeof REGION_LABEL.ko>;

  it.each(LOCALES)("%s 제목에 모든 열 이름이 있다", (locale) => {
    const title = YEAR[locale].metaTitle("1592");
    for (const c of cols) expect(title, `${locale} · ${c}`).toContain(REGION_LABEL[locale][c]);
  });

  it.each(LOCALES)("%s 대체 요약에 모든 열 이름이 있다", (locale) => {
    const summary = YEAR[locale].summaryFallback("1592");
    for (const c of cols) expect(summary, `${locale} · ${c}`).toContain(REGION_LABEL[locale][c]);
  });
});

/**
 * 칩 라벨 다듬기(2026-09-25, 진단 보고서 개선 7). 원문은 상세에 그대로 남고 표시만 다듬는다.
 * 끝 마침표는 어느 레벨에서나, 연도 접두는 **연도 레벨에서만** — 십년·세기에서 「1964년」은
 * 행이 알려 주지 않는 정확한 해다.
 */
describe("칩 라벨 다듬기", () => {
  it("끝 마침표 하나를 뗀다 — 한국어·영어·한자권", () => {
    expect(trimLabelEnd("보타종승묘가 완공되었다.")).toBe("보타종승묘가 완공되었다");
    expect(trimLabelEnd("Toyotomi Hideyoshi invaded Korea.")).toBe("Toyotomi Hideyoshi invaded Korea");
    expect(trimLabelEnd("萬曆朝鮮之役始。")).toBe("萬曆朝鮮之役始");
  });

  it("줄임표와 약어는 그대로 둔다 — 점을 떼면 뜻이 바뀐다", () => {
    expect(trimLabelEnd("Troops land in the U.S.")).toBe("Troops land in the U.S.");
    expect(trimLabelEnd("Martin Luther King Jr.")).toBe("Martin Luther King Jr.");
    expect(trimLabelEnd("그리고…")).toBe("그리고…");
    expect(trimLabelEnd("and so on...")).toBe("and so on...");
  });

  it("마침표가 없으면 그대로", () => {
    expect(trimLabelEnd("임진왜란")).toBe("임진왜란");
  });

  it("eventLabel이 다듬은 값을 낸다 — 격자·연도 페이지가 같은 라벨을 쓴다", () => {
    const ev = { title: "Treaty signed.", lang: "en", names: {} } as unknown as LabelSource;
    expect(eventLabel(ev, "en").text).toBe("Treaty signed");
  });

  it("연도 접두는 그 해일 때만 뗀다", () => {
    expect(dropYearPrefix("1952년 대한민국 지방 선거", 1952, "ko")).toBe("대한민국 지방 선거");
    expect(dropYearPrefix("1964 Summer Olympics", 1964, "en")).toBe("Summer Olympics");
    expect(dropYearPrefix("1964年東京オリンピック", 1964, "ja")).toBe("東京オリンピック");
    expect(dropYearPrefix("1952년 대한민국 지방 선거", 1956, "ko")).toBe("1952년 대한민국 지방 선거");
  });

  it("떼고 남는 것이 없거나 기원전이면 그대로", () => {
    expect(dropYearPrefix("1950년 전", 1950, "ko")).toBe("1950년 전");
    expect(dropYearPrefix("-56년 건국", -56, "ko")).toBe("-56년 건국");
  });
});

/** 한국어 원문 묶음 줄 나누기(shortKo) — 2026-09-25 두 오판을 고쳤다. */
describe("묶인 줄 나누기", () => {
  const ko = (title: string) => eventLabel({ title, lang: "ko", names: {} } as unknown as LabelSource, "ko").text;

  it("진짜 묶음은 여전히 「첫 사건 외 N」", () => {
    expect(ko("조미수호조규 체결, 임오군란 일어남, 일본과 제물포조약 체결")).toBe("조미수호조규 체결 외 2");
    expect(ko("5월 16일 신간회 해소, 조선어 학회 창립, 한인 애국단 수립")).toBe("5월 16일 신간회 해소 외 2");
  });

  it("첫 조각이 한 낱말이면 주어다 — 나누지 않는다", () => {
    expect(ko("1월 5일 정부, 제2차 경제개발 5개년계획안 수립.")).toBe("1월 5일 정부, 제2차 경제개발 5개년계획안 수립");
    expect(ko("대승, 도방정치")).toBe("대승, 도방정치");
  });

  it("괄호 안의 쉼표에서는 나누지 않는다", () => {
    expect(ko("이완(李完, 李琓) 출생")).toBe("이완(李完, 李琓) 출생");
    expect(ko("김옥균(金玉均, 1851~1894) 암살, 갑오개혁 시작")).toBe("김옥균(金玉均, 1851~1894) 암살 외 1");
  });
});

describe("dropMonthPrefix — 월 눈금이 이미 말하는 달", () => {
  it("그 사건의 달과 같은 「N월 — 」를 뗀다 — 중국·일본 열 159줄", () => {
    expect(dropMonthPrefix("6월 — 마읍 전투: 한나라의 계략", 6)).toBe("마읍 전투: 한나라의 계략");
    expect(dropMonthPrefix("12月 — 日本軍撤退", 12)).toBe("日本軍撤退");
    expect(dropMonthPrefix("June – Battle of Mayi", 6)).toBe("Battle of Mayi");
  });
  it("달이 다르거나 모르면 두다 — 오독일 수 있다", () => {
    expect(dropMonthPrefix("6월 — 마읍 전투", 7)).toBe("6월 — 마읍 전투");
    expect(dropMonthPrefix("6월 — 마읍 전투", undefined)).toBe("6월 — 마읍 전투");
  });
  it("일까지 적힌 것과 범위는 두다 — 눈금보다 정밀하다", () => {
    expect(dropMonthPrefix("5월 10일 남한 총선거", 5)).toBe("5월 10일 남한 총선거");
    expect(dropMonthPrefix("9월 – 10월 31일. 조선박람회", 9)).toBe("9월 – 10월 31일. 조선박람회");
  });
});
