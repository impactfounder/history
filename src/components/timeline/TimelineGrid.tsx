"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AXIS_SPAN_YEARS,
  AXIS_YEAR_START,
  anchorYearAt,
  centerYear,
  chunkKeyFor,
  clampScale,
  contentHeight,
  formatRowLabel,
  formatYear,
  levelOf,
  levelWithHysteresis,
  railWindow,
  scaleBounds,
  scrollTopForYear,
  visibleRows,
  yearToY,
  zoomToYear,
  type Axis,
  type Level,
} from "@/lib/timeline/axis";

/** 기본 4열 (PRD §5-2). 데이터는 M1에서 붙는다. */
const COLUMNS = [
  { id: "kr", label: "한국" },
  { id: "cn", label: "중국" },
  { id: "jp", label: "일본" },
  { id: "us", label: "미국" },
] as const;

/** 뷰포트 밖으로 더 그리는 행 수. 관성 스크롤의 지연을 흡수한다. */
const OVERSCAN_ROWS = 3;
/** 제스처가 끝났다고 보는 유휴 시간(ms). 이후 앵커 연도를 새로 잡는다. */
const GESTURE_IDLE_MS = 180;

export function TimelineGrid() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // s의 초기값은 십년 레벨. 착지 지점은 §11 C-1이 정해지면 바꾼다.
  const [axis, setAxis] = useState<Axis>({ s: 8, viewportH: 800 });
  const [scrollTop, setScrollTop] = useState(0);
  /** 의미 레벨은 스케일에서 바로 나오지 않는다 — 경계 왕복을 막는 이력이 있다(§5-3). */
  const [level, setLevel] = useState<Level>(() => levelOf(8));
  const [railH, setRailH] = useState(800);

  /** 줌으로 계산한 scrollTop. 스페이서 height가 쓰인 뒤 같은 패스에서 대입한다. */
  const pendingTop = useRef<number | null>(null);
  /** 연속 제스처가 붙잡고 있는 앵커. 픽셀이 아니라 연도다(§5-5A). */
  const gesture = useRef<{ year: number; offsetY: number; until: number } | null>(null);
  const rafRef = useRef(0);
  /** 이벤트 리스너가 최신 axis를 보게 한다 — 리스너를 재등록하지 않기 위해. */
  const axisRef = useRef(axis);
  axisRef.current = axis;

  // ── 뷰포트 높이 추적 ──────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sync = () => {
      const vh = el.clientHeight;
      // 창이 줄면 s도 함께 눌러야 한 행이 뷰포트를 넘지 않는다(§5-5A S_MAX)
      setAxis((a) => (a.viewportH === vh ? a : { s: clampScale(a.s, vh), viewportH: vh }));
      if (railRef.current) setRailH(railRef.current.clientHeight);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    if (railRef.current) setRailH(railRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  // ── 줌 결과 반영: 스페이서 height가 쓰인 뒤 같은 레이아웃 패스에서 ────────
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || pendingTop.current === null) return;
    el.scrollTop = pendingTop.current;
    pendingTop.current = null;
    // 읽어 오는 값은 브라우저가 반올림한 결과다(§11 C-11)
    setScrollTop(el.scrollTop);
  });

  // ── 스크롤 추적 (rAF 코얼레싱, DOM 쓰기 없음) ────────────────────────────
  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollerRef.current;
      if (el) setScrollTop(el.scrollTop);
    });
  }, []);

  // ── 줌: Ctrl+휠 · 핀치. 일반 휠은 브라우저에 맡긴다 ──────────────────────
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // 시간 이동은 네이티브 스크롤
      e.preventDefault(); // 브라우저 페이지 줌 차단

      const rect = el.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const now = performance.now();

      const cur = axisRef.current;
      let g = gesture.current;
      if (!g || now > g.until || Math.abs(g.offsetY - offsetY) > 24) {
        // 제스처 시작 — 앵커 연도를 여기서 한 번만 정한다
        g = { year: anchorYearAt(el.scrollTop, offsetY, cur), offsetY, until: 0 };
      }
      g.until = now + GESTURE_IDLE_MS;
      gesture.current = g;

      const sNext = clampScale(cur.s * Math.exp(-e.deltaY * 0.002), cur.viewportH);
      if (sNext === cur.s) return;

      pendingTop.current = zoomToYear(g.year, g.offsetY, sNext, cur.viewportH);
      setAxis((a) => ({ ...a, s: sNext }));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── 키보드 줌 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "+" && e.key !== "=" && e.key !== "-" && e.key !== "0") return;
      const el = scrollerRef.current;
      if (!el) return;
      const cur = axisRef.current;
      const mid = cur.viewportH / 2;
      const year = anchorYearAt(el.scrollTop, mid, cur);
      const sNext =
        e.key === "0" ? 8 : clampScale(cur.s * (e.key === "-" ? 1 / 1.6 : 1.6), cur.viewportH);
      pendingTop.current = zoomToYear(year, mid, sNext, cur.viewportH);
      setAxis((a) => ({ ...a, s: sNext }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 의미 레벨: s에서 파생하되 이력을 둔다(§5-3) ──────────────────────────
  useEffect(() => {
    setLevel((prev) => levelWithHysteresis(axis.s, prev));
  }, [axis.s]);

  // ── 파생값 ───────────────────────────────────────────────────────────────
  const rows = visibleRows(scrollTop, axis, level);
  const from = rows.from - rows.unit * OVERSCAN_ROWS;
  const to = rows.to + rows.unit * OVERSCAN_ROWS;
  const buckets: number[] = [];
  for (let b = from; b <= to; b += rows.unit) buckets.push(b);

  const win = railWindow(scrollTop, axis, railH);
  const bounds = scaleBounds(axis.viewportH);
  const chunkKeys = Array.from(new Set(buckets.map((b) => chunkKeyFor(b, rows.level))));

  const jumpFromRail = (clientY: number) => {
    const rail = railRef.current;
    const el = scrollerRef.current;
    if (!rail || !el) return;
    const r = rail.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientY - r.top) / r.height, 0), 1);
    const year = AXIS_YEAR_START + ratio * AXIS_SPAN_YEARS;
    el.scrollTop = scrollTopForYear(year, axis);
    setScrollTop(el.scrollTop);
  };

  return (
    <div className="flex h-full flex-col text-[13px]">
      {/* 상단바 — PRD §5-10, 56px */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-4">
        <span className="font-semibold tracking-tight">history</span>
        <span className="text-neutral-400">M2 스켈레톤 · 데이터는 M1 대기</span>
        <span className="ml-auto text-neutral-500">
          시간 이동은 스크롤 · 확대는 <kbd className="rounded border px-1">Ctrl</kbd>+휠 또는{" "}
          <kbd className="rounded border px-1">+</kbd>/<kbd className="rounded border px-1">−</kbd>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 시대 레일 — 네이티브 스크롤바를 대신한다(§5-10) */}
        <div
          ref={railRef}
          onPointerDown={(e) => jumpFromRail(e.clientY)}
          className="relative w-16 shrink-0 cursor-grab border-r border-neutral-200 bg-neutral-50 select-none"
          title="시대 레일 — 클릭하면 그 시대로 점프"
        >
          <div
            className="absolute inset-x-1 rounded bg-neutral-400/70"
            style={{ top: win.top, height: win.height }}
          />
        </div>

        {/* 스크롤 컨테이너 = 시간축 그 자체 (§5-5A) */}
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="relative min-w-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overflowAnchor: "none", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
        >
          {/* 스페이서 */}
          <div className="relative w-full" style={{ height: contentHeight(axis) }}>
            {buckets.map((b) => {
              const top = yearToY(b, axis);
              const h = rows.unit * axis.s;
              return (
                <div
                  key={b}
                  className="absolute inset-x-0 flex border-t border-neutral-200"
                  style={{ top, height: h }}
                >
                  {/* 연도 거터 (§5-10) */}
                  <div className="w-12 shrink-0 border-r border-neutral-200 px-1 text-[11px] text-neutral-500 tabular-nums">
                    {formatRowLabel(b, rows.level)}
                  </div>
                  {COLUMNS.map((c) => (
                    <div key={c.id} className="min-w-0 flex-1 border-r border-neutral-100" />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 하단 줌 바 자리 + 계측 HUD */}
      <footer className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-4 py-2 font-mono text-[11px] text-neutral-600">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            레벨 <b className="text-neutral-900">{rows.level}</b>
            {levelOf(axis.s) !== rows.level && <span className="text-amber-700"> (이력 유지)</span>} · s{" "}
            <b className="text-neutral-900">{axis.s.toFixed(2)}</b> px/년 (
            {bounds.min.toFixed(2)}–{bounds.max})
          </span>
          <span>
            스페이서 <b className="text-neutral-900">{Math.round(contentHeight(axis)).toLocaleString("ko-KR")}</b> px
          </span>
          <span>scrollTop {Math.round(scrollTop).toLocaleString("ko-KR")}</span>
          <span>
            중앙 <b className="text-neutral-900">{formatYear(Math.round(centerYear(scrollTop, axis)))}</b>
          </span>
          <span>
            보이는 행 {buckets.length}개 ({formatRowLabel(rows.from, rows.level)} ~{" "}
            {formatRowLabel(rows.to, rows.level)})
          </span>
          <span>청크 {chunkKeys.length}개: {chunkKeys.slice(0, 4).join(", ")}</span>
          <span>뷰포트 {axis.viewportH}px</span>
        </div>
      </footer>
    </div>
  );
}
