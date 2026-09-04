"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AXIS_SPAN_YEARS,
  AXIS_YEAR_START,
  anchorYearAt,
  bucketStart,
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

/** 기본 4열 (PRD §5-2). */
const COLUMNS = [
  { id: "kr", label: "한국" },
  { id: "cn", label: "중국" },
  { id: "jp", label: "일본" },
  { id: "us", label: "미국" },
] as const;
type RegionId = (typeof COLUMNS)[number]["id"];

/** 셀당 최대 칩 수(PRD §5-3). 넘치면 `+N`. */
const MAX_PER_CELL: Record<Level, number> = { century: 3, decade: 5, year: 8, month: 8 };
/** 뷰포트 밖으로 더 그리는 행 수. 관성 스크롤의 지연을 흡수한다. */
const OVERSCAN_ROWS = 3;
/** 제스처가 끝났다고 보는 유휴 시간(ms). 이후 앵커 연도를 새로 잡는다. */
const GESTURE_IDLE_MS = 180;

// ── 발행 포맷 (data-model §6-2) ──────────────────────────────────────────────
interface PublishedEvent {
  id: string;
  y0: number;
  approx: boolean;
  hist: "historical" | "traditional";
  title: string;
  lang: string;
  names: Partial<Record<RegionId, { nat?: string; lang?: string }>>;
  regions: { r: RegionId; imp: number; role: string }[];
  date_ko: string;
  /** 국사편찬위 연표에 맞춰진 공식 항목 수(한국 열). */
  official?: number;
}
interface Chunk { events: PublishedEvent[] }
/** 국사편찬위원회 연표 한 항목 — 원문 그대로. */
interface OfficialEntry { id: string; db: string; series: string | null; date_ko: string; text: string; url: string | null }
interface Detail {
  id: string;
  title: string;
  /** 위키백과 연표 원문 줄. editorial-policy §1-6 — 우리가 쓴 문장은 없다. */
  text: string;
  lang: string;
  year: number;
  license: string;
  official: (OfficialEntry & { license: string })[];
  src: { url: string; revid: number; accessedAt: string; license: string }[];
}
/** official/kr/{연도}.json — 이 해의 공식 연표. */
interface OfficialYear { year: number; count: number; shown: number; license: string; entries: OfficialEntry[] }
interface Manifest { stage: "published" | "preview"; counts: { events: number; officialMatched?: number } }

const DATA = "/data/v1";

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

  // ── 데이터: 청크 캐시 ─────────────────────────────────────────────────────
  // 보이는 행에서 청크 키가 나오고(§5-5A), 키마다 한 번만 받는다. 캐시는 ref에 두고
  // 도착할 때만 카운터로 다시 그린다 — 스크롤마다 state를 만지지 않기 위해서다.
  const chunks = useRef(new Map<string, PublishedEvent[] | null>());
  const inflight = useRef(new Set<string>());
  const [, bump] = useState(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selected, setSelected] = useState<{ ev: PublishedEvent; detail: Detail | null } | null>(null);
  /** 상세 패널 "이 해의 공식 연표" — 눌렀을 때만 받는다(한 해 최대 80건). */
  const [officialYear, setOfficialYear] = useState<OfficialYear | null>(null);

  useEffect(() => {
    fetch(`${DATA}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  const ensureChunk = useCallback((region: RegionId, key: string) => {
    const path = `${DATA}/events/${region}/${key}.json`;
    if (chunks.current.has(path) || inflight.current.has(path)) return;
    inflight.current.add(path);
    fetch(path)
      .then((r) => (r.ok ? (r.json() as Promise<Chunk>) : null))
      .then((c) => chunks.current.set(path, c?.events ?? null)) // 404도 기록 — 빈 구간은 다시 묻지 않는다
      .catch(() => chunks.current.set(path, null))
      .finally(() => {
        inflight.current.delete(path);
        bump((n) => n + 1);
      });
  }, []);

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
    return () => ro.disconnect();
  }, []);

  // ── 줌 결과 반영: 스페이서 height가 쓰인 뒤 같은 레이아웃 패스에서 ────────
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || pendingTop.current === null) return;
    el.scrollTop = pendingTop.current;
    pendingTop.current = null;
    setScrollTop(el.scrollTop); // 읽어 오는 값은 기기 픽셀 격자에 스냅된 결과다(§11 C-11)
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
        g = { year: anchorYearAt(el.scrollTop, offsetY, cur), offsetY, until: 0 }; // 제스처 시작 — 앵커 연도를 한 번만
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
      const sNext = e.key === "0" ? 8 : clampScale(cur.s * (e.key === "-" ? 1 / 1.6 : 1.6), cur.viewportH);
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

  // 보이는 청크를 받아 둔다(프리페치는 오버스캔 행 몫). 렌더 중 fetch 시작은 effect에서.
  useEffect(() => {
    for (const region of COLUMNS) for (const key of chunkKeys) ensureChunk(region.id, key);
  }, [chunkKeys.join("|"), ensureChunk]); // eslint-disable-line react-hooks/exhaustive-deps

  /** (열, 행 버킷) → 그 칸의 사건. 발행 시 정렬돼 있으므로 다시 정렬하지 않는다(§6-2). */
  const cellEvents = (region: RegionId, b: number): PublishedEvent[] => {
    const evs = chunks.current.get(`${DATA}/events/${region}/${chunkKeyFor(b, rows.level)}.json`);
    if (!evs) return [];
    return evs.filter((e) => bucketStart(e.y0, rows.unit) === b);
  };
  const loadedChunks = Array.from(chunks.current.values()).filter(Boolean).length;

  const openOfficialYear = (year: number) => {
    fetch(`${DATA}/official/kr/${year}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<OfficialYear>) : null))
      .then((o) => setOfficialYear(o))
      .catch(() => setOfficialYear(null));
  };
  const openDetail = (ev: PublishedEvent) => {
    setOfficialYear(null);
    setSelected({ ev, detail: null });
    fetch(`${DATA}/events/detail/${ev.id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
      .then((detail) => setSelected((s) => (s && s.ev.id === ev.id ? { ev, detail } : s)))
      .catch(() => {});
  };

  const jumpFromRail = (clientY: number) => {
    const rail = railRef.current;
    const el = scrollerRef.current;
    if (!rail || !el) return;
    const r = rail.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientY - r.top) / r.height, 0), 1);
    el.scrollTop = scrollTopForYear(AXIS_YEAR_START + ratio * AXIS_SPAN_YEARS, axis);
    setScrollTop(el.scrollTop);
  };

  return (
    <div className="flex h-full flex-col text-[13px]">
      {/* 상단바 — PRD §5-10, 56px */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-4">
        <span className="font-semibold tracking-tight">history</span>
        {manifest?.stage === "preview" ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">미리보기 · {manifest.counts.events}건 · 원문 그대로</span>
        ) : (
          <span className="text-neutral-400">{manifest ? `${manifest.counts.events}건` : "데이터 없음"}</span>
        )}
        <span className="ml-auto text-neutral-500">
          시간 이동은 스크롤 · 확대는 <kbd className="rounded border px-1">Ctrl</kbd>+휠 또는{" "}
          <kbd className="rounded border px-1">+</kbd>/<kbd className="rounded border px-1">−</kbd>
        </span>
        <a href="/sources" className="text-[11px] text-neutral-500 underline">출처</a>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 시대 레일 — 네이티브 스크롤바를 대신한다(§5-10) */}
        <div
          ref={railRef}
          onPointerDown={(e) => jumpFromRail(e.clientY)}
          className="relative w-16 shrink-0 cursor-grab border-r border-neutral-200 bg-neutral-50 select-none"
          title="시대 레일 — 클릭하면 그 시대로 점프"
        >
          <div className="absolute inset-x-1 rounded bg-neutral-400/70" style={{ top: win.top, height: win.height }} />
        </div>

        {/* 스크롤 컨테이너 = 시간축 그 자체 (§5-5A) */}
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="relative min-w-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overflowAnchor: "none", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
        >
          {/* 정치체 스티키 헤더 자리 — 밴드 데이터(M1 수작업) 전까지 열 이름만 */}
          <div className="sticky top-0 z-10 flex border-b border-neutral-200 bg-white/95 text-[11px] font-medium text-neutral-600 backdrop-blur">
            <div className="w-12 shrink-0 border-r border-neutral-200" />
            {COLUMNS.map((c) => (
              <div key={c.id} className="min-w-0 flex-1 border-r border-neutral-100 px-2 py-1">{c.label}</div>
            ))}
          </div>

          {/* 스페이서 */}
          <div className="relative w-full" style={{ height: contentHeight(axis) }}>
            {buckets.map((b) => {
              const top = yearToY(b, axis);
              const h = rows.unit * axis.s;
              const max = MAX_PER_CELL[rows.level];
              return (
                <div key={b} className="absolute inset-x-0 flex border-t border-neutral-200" style={{ top, height: h }}>
                  {/* 연도 거터 (§5-10) */}
                  <div className="w-12 shrink-0 border-r border-neutral-200 px-1 text-[11px] text-neutral-500 tabular-nums">
                    {formatRowLabel(b, rows.level)}
                  </div>
                  {COLUMNS.map((c) => {
                    const evs = cellEvents(c.id, b);
                    const shown = evs.slice(0, max);
                    // 칩은 가로로 흐른다(§5-10 목업 "칩 칩 +2"). 세로로 쌓으면 s가 작을 때 행 높이를 넘겨 잘린다.
                    return (
                      <div key={c.id} className="flex min-w-0 flex-1 flex-wrap content-start gap-1 overflow-hidden border-r border-neutral-100 px-1 py-0.5">
                        {shown.map((ev) => {
                          // 시각 위계(§5-10): 중요도 5 굵게 > 4 > 3 기본. 전승은 기울임.
                          const imp = ev.regions[0]?.imp ?? 3;
                          const tone =
                            imp >= 5
                              ? "border-neutral-800 bg-neutral-900 font-semibold text-white"
                              : imp === 4
                                ? "border-neutral-400 bg-neutral-100 font-medium text-neutral-900"
                                : "border-neutral-200 bg-white text-neutral-700";
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => openDetail(ev)}
                              title={ev.date_ko}
                              className={`max-w-full truncate rounded border px-1.5 py-0.5 text-left leading-tight ${tone}${ev.hist === "traditional" ? " italic" : ""}`}
                            >
                              {ev.title}
                              {ev.hist === "traditional" && <span className="text-neutral-400"> (전승)</span>}
                              {ev.official ? <span className="text-neutral-400" title="국사편찬위원회 연표에 있는 사건"> ◆</span> : null}
                            </button>
                          );
                        })}
                        {evs.length > max && (
                          <span className="inline-block rounded px-1 text-[11px] text-neutral-500">+{evs.length - max}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* 상세 패널 — §5-10. 지금은 push 한 모드만(폭 사다리는 다음) */}
        {selected && (
          <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-4" style={{ overscrollBehavior: "contain" }}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold leading-snug">{selected.ev.title}</h2>
              <button type="button" onClick={() => setSelected(null)} className="rounded px-2 text-neutral-500 hover:bg-neutral-100" aria-label="닫기">×</button>
            </div>
            <div className="mb-3 text-[12px] text-neutral-500">{selected.ev.date_ko} · 중요도 {selected.ev.regions[0]?.imp}</div>
            {selected.detail ? (
              <>
                {/* 공식 연표가 맞춰진 사건은 그쪽 본문이 앞에 선다(editorial-policy §1-7) */}
                {selected.detail.official.map((o) => (
                  <div key={o.id} className="mb-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <div className="mb-1 text-[11px] text-neutral-500">국사편찬위원회 · {o.db.replace(/^주제별연표_/, "")}{o.series ? ` (${o.series})` : ""} · {o.date_ko}</div>
                    <p className="leading-relaxed [text-wrap:pretty] [word-break:keep-all]">{o.text}</p>
                    {o.url && (
                      <a href={o.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-neutral-500 underline">한국사데이터베이스에서 보기</a>
                    )}
                  </div>
                ))}
                <p className="mb-1 text-[11px] text-neutral-500">위키백과 연표 원문{selected.detail.lang !== "ko" && <span> ({selected.detail.lang}) · 한글 옮김은 아직</span>}</p>
                <p className="mb-3 leading-relaxed [text-wrap:pretty] [word-break:keep-all]">{selected.detail.text}</p>
                {/* 이 사건을 부르는 이름 (§5-9) — 사이트링크 원문 */}
                {COLUMNS.some((c) => selected.ev.names[c.id]?.nat) && (
                  <table className="mb-3 w-full text-[12px]">
                    <tbody>
                      {COLUMNS.filter((c) => selected.ev.names[c.id]?.nat).map((c) => (
                        <tr key={c.id} className="border-t border-neutral-100">
                          <td className="py-1 pr-2 text-neutral-500">{c.label}</td>
                          <td className="py-1">{selected.ev.names[c.id]!.nat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {selected.ev.regions[0]?.r === "kr" && (
                  <div className="mb-3">
                    {officialYear ? (
                      <div className="rounded border border-neutral-200">
                        <div className="border-b border-neutral-200 px-2 py-1 text-[11px] text-neutral-500">
                          {officialYear.year <= 0 ? `기원전 ${1 - officialYear.year}년` : `${officialYear.year}년`}의 국사편찬위원회 연표 {officialYear.count}건
                          {officialYear.count > officialYear.shown && ` 중 ${officialYear.shown}건`}
                        </div>
                        <ul className="max-h-72 overflow-y-auto text-[12px]" style={{ overscrollBehavior: "contain" }}>
                          {officialYear.entries.map((o) => (
                            <li key={o.id} className="border-t border-neutral-100 px-2 py-1 [word-break:keep-all]">
                              <span className="text-neutral-500">{o.date_ko.replace(/^.*?년\s*/, "") || "날짜 미상"}</span> {o.text}
                              {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="ml-1 text-neutral-400 underline">↗</a>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <button type="button" onClick={() => openOfficialYear(selected.detail!.year)} className="rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-50">
                        이 해의 공식 연표 더 보기
                      </button>
                    )}
                  </div>
                )}
                <div className="text-[11px] leading-relaxed text-neutral-500">
                  출처 {selected.detail.official.length > 0 && <span>국사편찬위원회 연표(공공누리 · 제한 없음) · </span>}
                  {selected.detail.src.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline">{new URL(s.url).hostname}</a>
                  ))} ({selected.detail.license}) · <a href="/sources" className="underline">출처와 라이선스</a>
                </div>
              </>
            ) : (
              <p className="text-neutral-400">불러오는 중…</p>
            )}
          </aside>
        )}
      </div>

      {/* 하단 줌 바 자리 + 계측 HUD */}
      <footer className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-4 py-2 font-mono text-[11px] text-neutral-600">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            레벨 <b className="text-neutral-900">{rows.level}</b>
            {levelOf(axis.s) !== rows.level && <span className="text-amber-700"> (이력 유지)</span>} · s{" "}
            <b className="text-neutral-900">{axis.s.toFixed(2)}</b> px/년 ({bounds.min.toFixed(2)}–{bounds.max})
          </span>
          <span>스페이서 <b className="text-neutral-900">{Math.round(contentHeight(axis)).toLocaleString("ko-KR")}</b> px</span>
          <span>scrollTop {Math.round(scrollTop).toLocaleString("ko-KR")}</span>
          <span>중앙 <b className="text-neutral-900">{formatYear(Math.round(centerYear(scrollTop, axis)))}</b></span>
          <span>보이는 행 {buckets.length}개 ({formatRowLabel(rows.from, rows.level)} ~ {formatRowLabel(rows.to, rows.level)})</span>
          <span>청크 {chunkKeys.length}키 · 캐시 {loadedChunks}</span>
          <span>뷰포트 {axis.viewportH}px</span>
        </div>
      </footer>
    </div>
  );
}
