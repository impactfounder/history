"use client";

import { useEffect, useRef, useState } from "react";

import { HIT_COMFORT, HIT_MIN } from "@/lib/design/metrics";
import { REGION_LABEL, dupNames, eventLabel, formatYearL, type LabelSource, type Locale, type RegionId, type Strings } from "@/lib/i18n";
import { itemKind, originalTag } from "@/lib/timeline/item-kind";

/**
 * **행 시트 — 폰에서 그 해의 모든 열**(PRD §5-7 「행 시트가 리더」, P0).
 *
 * 폰 격자는 2열(360px 미만은 1열)이다. 그 제약이 비교 가치를 깎지 않게, 행을 탭하면 **격자에 없는 열까지**
 * 그 행의 사건을 열별로 묶어 보여 준다 — 「그리드는 내비게이터, 바텀 시트가 리더」. 칸 시트(CellSheet)가
 * 한 열의 한 칸이라면 이것은 한 행의 전부다.
 *
 * 명세 그대로: 반 높이(`50svh`, 최소 176px)로 열리고 위로 끌면 전체 화면(`100dvh`). **`100vh`는 쓰지 않는다** —
 * iOS 주소창이 그 높이에 들어가 시트 아래가 가려진다. 시트 안 스크롤은 뒤 격자로 새지 않는다.
 * 모달 규약은 상세 패널·검색·칸 시트와 같다 — Esc · 격자에 `inert` · 열릴 때 포커스.
 */
export type RowEvent = LabelSource & { id: string; y0: number };
export interface RowGroup {
  region: RegionId;
  events: RowEvent[];
  /** 그 칸의 총수 — 뒷부분(`.more.json`)이 아직 안 왔으면 events보다 크다. */
  total: number;
  /** 청크가 아직 안 왔다. */
  loading: boolean;
  /** 격자에 보이지 않는 열(폰은 2열이라 나머지는 여기서만 보인다). */
  offGrid: boolean;
  /** 수록 전 구간이면 그 안내(「1607년~ 수록」). 있으면 빈 칸이 「일이 없었다」가 아니다. */
  coverageNote?: string;
}

/** 손잡이를 이만큼 끌면 크기가 바뀐다. 작으면 탭과 헷갈리고 크면 끌어도 반응이 없어 보인다. */
const DRAG_THRESHOLD = 48;
/** 이보다 적게 움직였으면 끌기가 아니라 탭이다. */
const TAP_SLOP = 8;

export function RowSheet({
  t,
  locale,
  bucket,
  unit,
  groups,
  onPick,
  onClose,
}: {
  t: Strings;
  locale: Locale;
  bucket: number;
  unit: number;
  groups: RowGroup[];
  onPick: (region: RegionId, id: string) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const span = unit > 1 ? `${formatYearL(bucket, locale)}–${formatYearL(bucket + unit - 1, locale)}` : formatYearL(bucket, locale);

  /** 손잡이 끌기 — 위로 끌면 전체 화면, 아래로 끌면 반 높이, 반 높이에서 더 내리면 닫는다. */
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    // 거의 안 움직였으면 탭 — 크기를 바꾼다. 끌기와 탭을 여기 한 곳에서 가른다(click은 쓰지 않는다:
    // pointerup 뒤에 오므로 끌기 끝에 click이 또 와서 두 번 바뀐다)
    if (Math.abs(dy) < TAP_SLOP) setFull((v) => !v);
    else if (dy < -DRAG_THRESHOLD) setFull(true);
    else if (dy > DRAG_THRESHOLD) { if (full) setFull(false); else onClose(); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t.rowSheet(span)}
        className="flex w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-[var(--shadow-float)] outline-none"
        style={{ height: full ? "100dvh" : "max(50svh, 176px)" }}
      >
        {/* 손잡이 — 끌기와 탭(크기 바꾸기) 둘 다. 끄는 동안 뒤 격자로 제스처가 새지 않게 touch-action: none */}
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFull((v) => !v); } }}
          aria-label={full ? t.sheetCollapse : t.sheetExpand}
          className="flex shrink-0 items-center justify-center"
          style={{ height: HIT_MIN, touchAction: "none" }}
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden />
        </button>

        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 pb-2">
          <span className="font-serif text-item-lead tabular-nums">{span}</span>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ minWidth: HIT_COMFORT, minHeight: HIT_COMFORT }} className="ml-auto shrink-0 text-fg-subtle hover:text-fg">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4" style={{ overscrollBehavior: "contain" }}>
          {groups.map((g) => {
            const dup = dupNames(g.events, locale);
            const sorted = [...g.events].sort((a, b) => a.y0 - b.y0 || (a.id < b.id ? -1 : 1));
            return (
              <section key={g.region} className="border-b border-line-hairline px-4 py-3 last:border-b-0" aria-label={REGION_LABEL[locale][g.region]}>
                <h3 className="flex items-baseline gap-2">
                  {/* 나라색이 남는 자리 — 열 헤더 이름과 같은 역할(1b 규칙) */}
                  <span className="text-item-lead font-bold" style={{ color: `var(--color-region-${g.region})` }}>
                    {REGION_LABEL[locale][g.region]}
                  </span>
                  {g.offGrid && <span className="rounded border border-line px-1 text-block-label text-fg-subtle">{t.offGrid}</span>}
                  <span className="ml-auto text-item-meta tabular-nums text-fg-subtle">{g.loading ? "" : t.count(g.total)}</span>
                </h3>
                {g.loading ? (
                  <p className="mt-1 text-item-meta text-fg-subtle">{t.loading}</p>
                ) : sorted.length === 0 ? (
                  <p className="mt-1 text-item-meta text-fg-subtle">{g.coverageNote ?? t.rowEmpty}</p>
                ) : (
                  <ul className="mt-1">
                    {sorted.map((ev) => {
                      const label = eventLabel(ev, locale, dup);
                      const kind = itemKind(ev, locale);
                      const tag = originalTag(ev, locale);
                      return (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => onPick(g.region, ev.id)}
                            className="flex w-full items-baseline gap-3 py-2 text-left hover:bg-surface-hover [word-break:keep-all]"
                            style={{ minHeight: HIT_COMFORT }}
                          >
                            {unit > 1 && <span className="shrink-0 text-item-meta tabular-nums text-fg-subtle">{formatYearL(ev.y0, locale)}</span>}
                            <span lang={label.name !== undefined ? locale : ev.lang} className={`min-w-0 flex-1 ${kind === "lead" ? "text-item-lead" : "text-item text-fg-strong"}`}>
                              {label.name ?? label.text ?? ev.title}
                            </span>
                            {tag && <span className="shrink-0 rounded border border-line px-1 text-block-label text-fg-subtle">{tag}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!g.loading && g.total > g.events.length && <p className="mt-1 text-item-meta text-fg-subtle">{t.loading}</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
