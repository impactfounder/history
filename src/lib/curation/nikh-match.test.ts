import { describe, expect, it } from "vitest";
import { bestMatches, hasTerm, keyTerms, occurrence, parseWikiDate, scoreMatch, segments, stripYear } from "./nikh-match.mjs";

// 국사편찬위 항목 모양(tools/fetch-nikh.mjs 출력). 본문에 출전이 붙어 온다.
const n = (id: string, db: string, m: number | undefined, d: number | undefined, text: string, title = text.slice(0, 30)) => ({
  id, db, title, text, date: { y: 0, m, d }, level: 2, url: null,
});

describe("stripYear / parseWikiDate / segments", () => {
  it("연도 표기를 뗀다 — ko·BC·en", () => {
    expect(stripYear("1882년 조미수호조규 체결")).toBe("조미수호조규 체결");
    expect(stripYear("BC.238년경 고조선 성립")).toBe("고조선 성립");
    expect(stripYear("1882: Imo Incident: Mutiny")).toBe("Imo Incident: Mutiny");
  });
  it("한자권 연도 표기도 뗀다 — 원호 괄호·約·前·年代", () => {
    expect(stripYear("1600年（慶長5年） 関ヶ原の戦い")).toBe("関ヶ原の戦い");
    expect(stripYear("前386年：周安王正式冊命田和")).toBe("周安王正式冊命田和");
    expect(stripYear("約前1747年：不降西征。")).toBe("不降西征。");
    expect(stripYear("紀元前2万年頃 現生人類が入植する。")).toBe("現生人類が入植する。");
    expect(stripYear("1960年代 高度成長")).toBe("高度成長");
  });
  it("행 안의 월·일을 읽는다", () => {
    expect(parseWikiDate("1983년 6월 30일 KBS 이산가족 찾기")).toEqual({ m: 6, d: 30 });
    expect(parseWikiDate("2009년 5월 노무현 전 대통령 서거")).toEqual({ m: 5 });
    expect(parseWikiDate("15 August. The assassination")).toEqual({ m: 8, d: 15 });
    expect(parseWikiDate("1953: Armistice")).toEqual({});
  });
  it("ko 표 행은 쉼표로 나누고, 날짜는 세그먼트에서 뺀다", () => {
    expect(segments("1882년 조미수호조규 체결, 임오군란 일어남, 일본과 제물포조약 체결", { split: true }))
      .toEqual(["조미수호조규 체결", "임오군란 일어남", "일본과 제물포조약 체결"]);
    expect(segments("1983년 6월 30일 KBS 이산가족 찾기 생방송이 시작", { split: true })).toEqual(["KBS 이산가족 찾기 생방송이 시작"]);
    expect(segments("1882: Imo Incident: Mutiny, by soldiers", { split: false })).toEqual(["Imo Incident: Mutiny, by soldiers"]);
  });
});

describe("keyTerms", () => {
  it("조사·서술어를 떼고 3자 이상 한글 어절만 남긴다", () => {
    expect(keyTerms("임오군란이 일어남")).toEqual(["임오군란"]);
    expect(keyTerms("경복궁 중건")).toEqual(["경복궁"]);
    expect(keyTerms("Imo Incident Korean soldiers")).toEqual([]); // 영어는 핵심어가 아니다
  });
});

describe("scoreMatch / bestMatches", () => {
  it("ko 표제어가 본문에 있으면 강한 신호", () => {
    const s = scoreMatch("Imo Incident: Mutiny by Korean soldiers", "임오군란", {}, n("a", "근대사연표", 6, 9, "무위영 군인들이 급료 체불에 격분, 임오군란을 일으킴≪고종실록≫"));
    expect(s.accept).toBe(true);
    expect(s.why[0]).toBe("표제어:임오군란");
  });
  it("영어 행은 표제어 없이는 잡지 않는다 — 'Korea'가 본문에 있어도", () => {
    const s = scoreMatch("Inspired by the Fourteen Points, Korean students", null, {}, n("a", "근대사연표", 4, 14, "미국 필라델피아 'The First Korean Congress' 개최"));
    expect(s.accept).toBe(false);
  });
  it("날짜 일치가 같은 주제의 다른 항목보다 앞선다 — 6월 30일 시작 vs 11월 마감", () => {
    const start = n("s", "대한민국사연표", 6, 30, "한국방송공사, 방송 통한 이산가족찾기사업 시작");
    const end = n("e", "대한민국사연표", 11, 14, "KBS 이산가족찾기 생방송 마감 △10만 952건 신청");
    const m = bestMatches({ text: "1983년 6월 30일 KBS 이산가족 찾기 생방송이 시작", koName: null, split: true }, [end, start]);
    expect(m.map((x) => x.n.id)).toEqual(["s"]);
  });
  it("묶인 행은 세그먼트마다 하나씩, 같은 항목은 한 번만, 일반 연표 우선", () => {
    const c = [
      n("1", "근대사연표", 4, 6, "조미수호통상조약 체결"),
      n("2", "근대사연표", 6, 9, "구식 군인들이 임오군란을 일으킴"),
      n("3", "주제별연표_ch_wa", 6, 9, "무위영 군인들이 임오군란을 일으킴"),
    ];
    const m = bestMatches({ text: "1882년 조미수호조규 체결, 임오군란 일어남", koName: null, split: true }, c);
    expect(m.map((x) => x.n.id).sort()).toEqual(["1", "2"]); // "조미수호조규"↔"조미수호통상조약"은 2-gram으로 잡힌다(같은 조약)
    expect(m.find((x) => x.seg.startsWith("임오군란"))?.n.db).toBe("근대사연표"); // 주제별보다 일반 연표
  });
  it("핵심어는 어절 첫머리여야 한다 — '지세령'은 '시가지세령'이 아니다", () => {
    expect(hasTerm("시가지세령 발포", "지세령")).toBe(false);
    expect(hasTerm("정부, 지세령 공포", "지세령")).toBe(true);
    expect(hasTerm("방송 통한 이산가족찾기사업 시작", "이산가족 찾기")).toBe(true); // 띄어쓰기 차이는 허용
  });
  it("일반어(대한민국·대통령…)는 핵심어도 표제어도 아니다", () => {
    expect(keyTerms("대한민국 헌법이 공포됨")).toEqual([]);
    const s = scoreMatch("대한제국을 수립해 연호를 광무로 고침", "대한제국", {}, n("a", "근대사연표", 11, 13, "일본정부, 대한제국의 국호를 승인"));
    expect(s.accept).toBe(false);
  });
  it("같은 날짜에 글자가 조금이라도 겹치면 받는다 — 헌법 공포", () => {
    const s = scoreMatch("대한민국 헌법이 공포됨", null, { m: 7, d: 17 }, n("a", "대한민국사연표", 7, 17, "제헌헌법 공포·시행"));
    expect(s.accept).toBe(true);
  });
  it("같은 표제어가 여럿이면 '발생' 항목이 '관하여·구실로' 항목을 이긴다 — 임오군란 1882", () => {
    const c = [
      n("a", "근대사연표", 2, 21, "유학생 兪吉濬과 尹致昊, 임오군란에 관하여 일본정부에 상신서 제출."),
      n("b", "근대사연표", 6, 9, "임오군란 발생. (일본 花房공사 인천에 도망)"),
      n("c", "근대사연표", 6, 29, "임오군란 구실로 일본군 인천에 침입."),
      n("d", "영남유학연표", undefined, undefined, "임오군란"),
    ];
    const m = bestMatches({ text: "1882: Imo Incident: Mutiny by Korean soldiers in Seoul.", koName: "임오군란", split: false }, c);
    expect(m[0]?.n.id).toBe("b");
    expect(occurrence("임오군란 구실로 일본군", "임오군란")).toBe(-0.3);
  });
  it("아무 신호도 없으면 빈 배열", () => {
    expect(bestMatches({ text: "992년 국자감 설치", koName: null, split: true }, [n("x", "고대사연표", 1, 1, "거란이 침입함")])).toEqual([]);
  });
});
