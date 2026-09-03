import { describe, expect, it } from "vitest";
import {
  anchorYearAt,
  AXIS_SPAN_YEARS,
  AXIS_YEAR_END,
  AXIS_YEAR_START,
  bucketStart,
  centerYear,
  chunkKeyFor,
  clampScale,
  contentHeight,
  formatRowLabel,
  formatYear,
  levelOf,
  levelWithHysteresis,
  maxScrollTop,
  railWindow,
  railY,
  scaleBounds,
  scrollTopForYear,
  visibleRows,
  visibleYears,
  yearToY,
  yToYear,
  zoomAt,
  zoomToYear,
  type Axis,
  type Level,
} from "./axis";

// PRD §5-5A 검산표 T1~T10을 그대로 옮긴 것 + 왕복 속성 검증.
// 데스크톱 기준 뷰포트는 800px, 최소 지원 뷰포트(360×640)의 그리드 높이는
// 640 − 136(고정 크롬) = 504px다.

const desktop: Axis = { s: 40, viewportH: 800 };

describe("도메인 상수", () => {
  it("기원전 500년은 천문학적 −499이고 축 길이는 2,526년이다", () => {
    expect(AXIS_YEAR_START).toBe(-499);
    expect(AXIS_YEAR_END).toBe(2026);
    expect(AXIS_SPAN_YEARS).toBe(2526);
  });
});

describe("T1 — 축 하한에서의 보이는 연도", () => {
  it("scrollTop 0이면 상단 여백 때문에 축 밖이 나오지만 clamp된다", () => {
    // 여백 없이 계산하면 −509(기원전 510년)가 나온다
    expect(yToYear(0, desktop)).toBeCloseTo(-509, 10);
    expect(visibleYears(0, desktop)).toEqual({ from: -499, to: -489 });
  });

  it("축 상한에서도 clamp된다", () => {
    const t = maxScrollTop(desktop);
    expect(visibleYears(t, desktop).to).toBe(AXIS_YEAR_END);
  });
});

describe("T2·T3 — 줌 앵커", () => {
  const scrollTop = 1000;
  const anchor = 400;

  it("T2 앵커 아래 연도는 기원전 475년(천문학적 −474)이다", () => {
    expect(yToYear(scrollTop + anchor, desktop)).toBeCloseTo(-474, 10);
    expect(formatYear(-474)).toBe("기원전 475년");
  });

  it("T3 s를 40 → 80으로 올려도 앵커 연도가 그대로다", () => {
    const next = zoomAt(scrollTop, anchor, 40, 80, 800);
    expect(next).toBe(2000);
    expect(yToYear(next + anchor, { s: 80, viewportH: 800 })).toBeCloseTo(-474, 10);
  });

  it("축소해도, 앵커가 어디에 있어도 연도가 고정된다", () => {
    let checked = 0;
    for (const s of [0.5, 4, 40, 120, 399]) {
      for (const sNext of [0.5, 4, 40, 120, 399]) {
        for (const t0 of [600, 20000, 400000]) {
          for (const a of [0, 200, 400, 799]) {
            // clamp가 걸리는 구간은 제외한다 — 축 끝에서는 앵커보다 경계가 이긴다
            const raw = (t0 + a - 400) * (sNext / s) + 400 - a;
            if (raw < 0 || raw > maxScrollTop({ s: sNext, viewportH: 800 })) continue;
            if (t0 > maxScrollTop({ s, viewportH: 800 })) continue;
            const before = yToYear(t0 + a, { s, viewportH: 800 });
            const t = zoomAt(t0, a, s, sNext, 800);
            expect(yToYear(t + a, { s: sNext, viewportH: 800 })).toBeCloseTo(before, 6);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50); // 가드가 전부 걸러내지 않았는지 확인
  });

  it("축 양끝에서는 앵커가 보존되지 않고 경계에 붙는다", () => {
    // 스크롤 축이 유한하므로 피할 수 없다. 지도·문서 뷰어와 같은 동작이다.
    const t = zoomAt(600, 799, 4, 0.5, 800);
    expect(t).toBe(0);
    expect(yToYear(t + 799, { s: 0.5, viewportH: 800 })).not.toBeCloseTo(
      yToYear(600 + 799, { s: 4, viewportH: 800 }),
      0,
    );
  });
});

describe("T11 — 앵커를 연도 공간에 두면 반올림이 누적되지 않는다", () => {
  // Chrome 152 실측: scrollTop은 기기 픽셀 격자(1/DPR)에 스냅된다(C-11).
  // 최악은 DPR 1 — 격자가 1px이라 정수 반올림과 같다. 그 조건으로 검증한다.
  const round = (v: number) => Math.round(v);

  const STEPS = [57, 91, 138, 211, 307, 399];
  const S_END = STEPS[STEPS.length - 1]!;

  /** 확대 제스처를 6단계 흉내 내고 앵커 연도가 얼마나 흘렀는지 최댓값을 낸다. */
  function worstDrift(holdYear: boolean): number {
    let worst = 0;
    for (const a of [0, 137, 400, 613, 799]) {
      for (const y0 of [1500, 1592.37, 300.5, 1863.9]) {
        let s = 40;
        let t = round(scrollTopForYear(y0, { s, viewportH: 800 }));
        const anchorYear = anchorYearAt(t, a, { s, viewportH: 800 });
        for (const sNext of STEPS) {
          t = round(
            holdYear
              ? zoomToYear(anchorYear, a, sNext, 800)
              : zoomAt(t, a, s, sNext, 800), // 반올림된 값이 다음 입력이 된다
          );
          s = sNext;
        }
        worst = Math.max(worst, Math.abs(yToYear(t + a, { s, viewportH: 800 }) - anchorYear));
      }
    }
    return worst;
  }

  it("앵커 연도를 들고 다니면 오차가 마지막 반올림 한 번치를 넘지 않는다", () => {
    // 0.5px / 399 px per year ≈ 0.46일
    expect(worstDrift(true)).toBeLessThanOrEqual(0.5 / S_END + 1e-9);
  });

  it("scrollTop을 매번 다시 읽으면 그 경계를 넘어선다", () => {
    expect(worstDrift(false)).toBeGreaterThan(worstDrift(true));
  });

  it("zoomAt은 zoomToYear에 위임하므로 단발 결과가 같다", () => {
    const a = 250;
    const year = anchorYearAt(3000, a, { s: 40, viewportH: 800 });
    expect(zoomAt(3000, a, 40, 120, 800)).toBeCloseTo(zoomToYear(year, a, 120, 800), 10);
  });
});

describe("T4 — 축 시작점", () => {
  it("어떤 스케일에서도 yearToY(축 시작) = padTop이다", () => {
    for (const s of [0.32, 4, 40, 399]) {
      expect(yearToY(AXIS_YEAR_START, { s, viewportH: 800 })).toBe(400);
    }
  });
});

describe("T5 — 레벨 경계", () => {
  it("s 39.9와 40.1은 십년 ↔ 연도 경계다", () => {
    expect(levelOf(39.9)).toBe("decade");
    expect(levelOf(40.1)).toBe("year");
    expect(levelOf(3.99)).toBe("century");
    expect(levelOf(4)).toBe("decade");
  });

  it("경계를 넘어도 앵커 연도는 그대로이고 행 단위만 바뀐다", () => {
    const a = 400;
    const before = yToYear(5000 + a, { s: 39.9, viewportH: 800 });
    const t = zoomAt(5000, a, 39.9, 40.1, 800);
    const after = yToYear(t + a, { s: 40.1, viewportH: 800 });
    expect(after).toBeCloseTo(before, 6);

    expect(visibleRows(5000, { s: 39.9, viewportH: 800 }).unit).toBe(10);
    expect(visibleRows(t, { s: 40.1, viewportH: 800 }).unit).toBe(1);
  });
});

describe("T12 — 레벨 전환 히스테리시스", () => {
  it("경계를 조금 넘은 정도로는 레벨이 바뀌지 않는다", () => {
    // 십년 구간은 [4, 40). 5% 이력이면 42까지 버틴다.
    expect(levelWithHysteresis(41, "decade")).toBe("decade");
    expect(levelWithHysteresis(43, "decade")).toBe("year");
    // 반대 방향: 연도 구간 [40, 400)은 38까지 버틴다
    expect(levelWithHysteresis(39, "year")).toBe("year");
    expect(levelWithHysteresis(37, "year")).toBe("decade");
  });

  it("경계에서 미세하게 왕복해도 레벨이 붙어 있다", () => {
    let level: Level = "decade";
    let flips = 0;
    for (const s of [39.8, 40.2, 39.9, 40.1, 39.95, 40.05, 39.99]) {
      const next = levelWithHysteresis(s, level);
      if (next !== level) flips++;
      level = next;
    }
    expect(flips).toBe(0);
    expect(level).toBe("decade");
  });

  it("이력 없이 판정하면 같은 구간에서 계속 뒤집힌다", () => {
    let flips = 0;
    let level: Level = "decade";
    for (const s of [39.8, 40.2, 39.9, 40.1, 39.95, 40.05, 39.99]) {
      const next = levelOf(s);
      if (next !== level) flips++;
      level = next;
    }
    expect(flips).toBeGreaterThan(4);
  });

  it("prev가 null이면(첫 렌더·URL 복원) 이력 없이 판정한다", () => {
    expect(levelWithHysteresis(41, null)).toBe("year");
    expect(levelWithHysteresis(39, null)).toBe("decade");
  });

  it("멀리 뛰면 이력을 무시하고 바로 넘어간다", () => {
    expect(levelWithHysteresis(300, "century")).toBe("year");
    expect(levelWithHysteresis(1, "year")).toBe("century");
  });

  it("visibleRows가 붙잡아 둔 레벨을 그대로 쓴다", () => {
    const a: Axis = { s: 41, viewportH: 800 };
    expect(visibleRows(5000, a).unit).toBe(1); // 이력 없이는 연도
    expect(visibleRows(5000, a, "decade").unit).toBe(10); // 붙잡아 두면 십년
  });
});

describe("T6 — 세기 레벨의 조망 한계", () => {
  it("s=4에서 스페이서는 10,904px이고 한 화면에 200년만 들어온다", () => {
    const a: Axis = { s: 4, viewportH: 800 };
    expect(contentHeight(a)).toBe(10904);
    const v = visibleYears(3000, a);
    expect(v.to - v.from).toBeCloseTo(200, 10);
  });

  it("축 전체를 보려면 S_MIN(0.32 px/년)까지 내려가야 하고 세기 행은 32px이 된다", () => {
    const { min } = scaleBounds(800);
    expect(min).toBeCloseTo(0.3167, 4);
    expect(100 * min).toBeCloseTo(31.7, 1); // 세기 행 높이
    // §11 C-1의 "전체 조망" 안이 왜 성립하지 않는지의 근거
  });
});

describe("T7 — 기원전 라벨", () => {
  it("세기 버킷은 범위 표기다", () => {
    expect(bucketStart(-450, 100)).toBe(-500);
    expect(formatRowLabel(-500, "century")).toBe("기원전 501–402년");
    expect(formatRowLabel(-100, "century")).toBe("기원전 101–2년");
  });

  it("이음매 버킷은 기원전과 서기에 걸친다", () => {
    expect(formatRowLabel(0, "century")).toBe("기원전 1년–서기 99년");
    expect(formatRowLabel(0, "decade")).toBe("기원전 1년–서기 9년");
  });

  it("서기는 현행 표기를 유지한다", () => {
    expect(formatRowLabel(1500, "century")).toBe("1500년대");
    expect(formatRowLabel(1590, "decade")).toBe("1590년대");
    expect(formatRowLabel(1592, "year")).toBe("1592년");
  });

  it("연도 레벨의 기원전은 단일 연도다", () => {
    expect(formatRowLabel(0, "year")).toBe("기원전 1년");
    expect(formatRowLabel(-499, "year")).toBe("기원전 500년");
  });
});

describe("T8 — clamp", () => {
  it("줌 결과가 축 양끝을 벗어나지 않는다", () => {
    expect(zoomAt(0, 0, 40, 400, 800)).toBe(0);
    const bottom = zoomAt(maxScrollTop(desktop), 800, 40, 399, 800);
    expect(bottom).toBeLessThanOrEqual(maxScrollTop({ s: 399, viewportH: 800 }));
    expect(bottom).toBeGreaterThanOrEqual(0);
  });

  it("scrollTopForYear도 clamp된다", () => {
    expect(scrollTopForYear(AXIS_YEAR_START, desktop)).toBe(0);
    expect(scrollTopForYear(-9999, desktop)).toBe(0);
    expect(scrollTopForYear(9999, desktop)).toBe(maxScrollTop(desktop));
  });
});

describe("T9 — 청크 키는 행 버킷보다 한 자릿수 크다", () => {
  it("연도 행 1592는 10년 묶음 파일에 들어간다", () => {
    expect(chunkKeyFor(1592, "year")).toBe("year/1590");
  });
  it("십년 행 1590은 100년 묶음 파일에 들어간다", () => {
    expect(chunkKeyFor(1590, "decade")).toBe("decade/1500");
  });
  it("세기는 열당 한 파일이다", () => {
    expect(chunkKeyFor(-500, "century")).toBe("century/all");
  });
  it("기원전 키는 천문학적 음수 그대로다", () => {
    expect(chunkKeyFor(-495, "decade")).toBe("decade/-500");
  });
});

describe("T10 — 시대 레일", () => {
  it("연도 도메인 매핑은 스케일과 무관하다", () => {
    for (const s of [0.32, 40, 399]) {
      expect(railY(1592, 600)).toBeCloseTo(496.67, 1);
      void s;
    }
  });

  it("여백이 상하 대칭인 지금 규약에서는 스크롤 비율이 '중앙 연도'와 일치한다", () => {
    // PRD §5-10은 비율 매핑이 어긋난다고 적었으나, 실제로 어긋나는 것은
    // 비율을 '뷰포트 상단 연도'로 읽을 때다. 중앙 연도로 읽으면 같은 값이다.
    const t = scrollTopForYear(1592, desktop);
    const ratio = t / (contentHeight(desktop) - desktop.viewportH);
    expect(ratio * 600).toBeCloseTo(railY(1592, 600), 6);
    expect(railY(yToYear(t, desktop), 600)).not.toBeCloseTo(ratio * 600, 1); // 상단으로 읽으면 어긋난다
  });

  it("창 높이는 연도 레벨에서 1px 미만이라 최소값으로 보정된다", () => {
    const deep: Axis = { s: 399, viewportH: 800 };
    const raw = (800 / 399 / AXIS_SPAN_YEARS) * 600;
    expect(raw).toBeLessThan(1);
    const w = railWindow(scrollTopForYear(1592, deep), deep, 600);
    expect(w.height).toBe(8);
    expect(w.top).toBeGreaterThanOrEqual(0);
    expect(w.top + w.height).toBeLessThanOrEqual(600);
  });

  it("축 양끝에서도 창이 쪼그라들지 않는다", () => {
    const w0 = railWindow(0, desktop, 600);
    const w1 = railWindow(maxScrollTop(desktop), desktop, 600);
    expect(w0.height).toBeCloseTo(w1.height, 6);
    expect(w0.top).toBe(0);
    expect(w1.top + w1.height).toBeCloseTo(600, 6);
  });
});

describe("스케일 경계", () => {
  it("최소 지원 뷰포트(그리드 504px)에서도 하한·상한이 성립한다", () => {
    const b = scaleBounds(504);
    expect(b.min).toBeCloseTo(0.1995, 4);
    expect(b.max).toBe(399);
    expect(clampScale(1000, 504)).toBe(399);
    expect(clampScale(0.001, 504)).toBeCloseTo(b.min, 10);
  });

  it("세로가 아주 짧은 창에서는 상한이 뷰포트 높이로 눌린다", () => {
    // 폰 가로(높이 360) → 그리드 224px. 연도 행이 뷰포트를 넘지 않게 한다.
    expect(scaleBounds(224).max).toBe(224);
  });
});

describe("왕복 속성", () => {
  it("yearToY와 yToYear는 서로의 역함수다", () => {
    for (const s of [0.32, 4, 40, 399]) {
      for (const y of [-499, -1, 0, 1, 1592, 2026]) {
        expect(yToYear(yearToY(y, { s, viewportH: 800 }), { s, viewportH: 800 })).toBeCloseTo(y, 6);
      }
    }
  });

  it("scrollTopForYear와 centerYear는 서로의 역함수다", () => {
    for (const y of [-400, 0, 1592, 2000]) {
      expect(centerYear(scrollTopForYear(y, desktop), desktop)).toBeCloseTo(y, 6);
    }
  });

  it("maxScrollTop은 contentHeight − viewportH와 같다", () => {
    for (const s of [0.32, 40, 399]) {
      const a = { s, viewportH: 800 };
      expect(maxScrollTop(a)).toBeCloseTo(contentHeight(a) - a.viewportH, 6);
    }
  });
});

describe("P1 경계", () => {
  it("월 레벨은 아직 정의되지 않았음을 명시적으로 알린다", () => {
    expect(levelOf(400)).toBe("month");
    expect(() => visibleRows(0, { s: 400, viewportH: 800 })).toThrow(/P1/);
    expect(() => chunkKeyFor(1592, "month")).toThrow(/P1/);
    expect(() => formatRowLabel(1592, "month")).toThrow(/P1/);
  });

  it("clampScale이 P0에서 월 레벨 진입을 막는다", () => {
    expect(levelOf(clampScale(9999, 800))).toBe("year");
  });
});

describe("총 높이 — PRD §5-5A 표와 일치", () => {
  it.each([
    [4, 10104],
    [40, 101040],
    [399, 1007874],
    [400, 1010400],
  ])("s=%i이면 스페이서 본문이 %ipx", (s, h) => {
    expect(AXIS_SPAN_YEARS * s).toBe(h);
  });
});
