"use client";

import { useEffect, useRef } from "react";

import { HIT_MIN } from "@/lib/design/metrics";
import { REGION_LABEL, dupNames, eventLabel, formatYearL, type LabelSource, type Locale, type RegionId, type Strings } from "@/lib/i18n";
import { itemKind, originalTag } from "@/lib/timeline/item-kind";

/**
 * **가려진 것에 닿는 길.** 셀이 좁으면 항목이 잘리고 오른쪽 아래에 `26건 더` 배지가 뜬다.
 * 그런데 그 배지는 `pointer-events-none`인 `<span>`이라 **누를 수 없었다** — 가려진 사건은
 * 확대 말고는 닿을 방법이 없었다. PRD §4-1·§5-3이 「`+N` 오버레이 팝오버」로 적어 둔 자리다.
 *
 * 여기 보이는 것은 **그 셀의 전부**다(보이던 것 + 가려진 것). 보이던 것을 빼면 "내가 방금 본
 * 목록이 왜 여기 없지"가 되고, 이 시트가 셀의 진실을 말하지 못한다.
 *
 * 모달 규약은 상세 패널·검색과 같다 — Esc · 격자에 `inert` · 열릴 때 포커스.
 */
export type CellEvent = LabelSource & { id: string; y0: number };

export function CellSheet({
  t,
  locale,
  region,
  bucket,
  unit,
  events,
  onPick,
  onClose,
}: {
  t: Strings;
  locale: Locale;
  region: RegionId;
  /** 셀이 덮는 첫 해. 제목에 쓴다. */
  bucket: number;
  /** 셀 한 칸이 덮는 햇수(세기 100 · 십년 10 · 연도 1). */
  unit: number;
  /** 라벨 규칙이 쓰는 것 + 목록에 필요한 id·연도. 그리드의 `PublishedEvent`가 이것을 만족한다. */
  events: CellEvent[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** 같은 셀의 중복 라벨 규칙 — 격자와 같은 것을 쓴다(i18n.ts의 dupNames). */
  const dup = dupNames(events, locale);
  const sorted = [...events].sort((a, b) => a.y0 - b.y0 || (a.id < b.id ? -1 : 1));
  const span = unit > 1 ? `${formatYearL(bucket, locale)}–${formatYearL(bucket + unit - 1, locale)}` : formatYearL(bucket, locale);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${span} · ${REGION_LABEL[locale][region]}`}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-[var(--shadow-float)] outline-none sm:rounded-card"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <span className="font-serif text-item-lead tabular-nums">{span}</span>
          <span className="text-item-meta font-bold" style={{ color: `var(--color-region-${region})` }}>
            {REGION_LABEL[locale][region]}
          </span>
          <span className="ml-auto text-item-meta text-fg-subtle tabular-nums">{t.badge(sorted.length)}</span>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ minWidth: HIT_MIN, minHeight: HIT_MIN }} className="shrink-0 text-fg-subtle hover:text-fg">
            ×
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto py-1" style={{ overscrollBehavior: "contain" }}>
          {sorted.map((ev) => {
            const label = eventLabel(ev, locale, dup);
            const kind = itemKind(ev, locale);
            const tag = originalTag(ev, locale);
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => onPick(ev.id)}
                  className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-surface-hover"
                  style={{ minHeight: HIT_MIN }}
                >
                  <span className="shrink-0 text-item-meta tabular-nums text-fg-subtle">{formatYearL(ev.y0, locale)}</span>
                  <span lang={label.name !== undefined ? locale : ev.lang} className={`min-w-0 flex-1 ${kind === "lead" ? "text-item-lead" : "text-item text-fg-strong"}`}>
                    {label.name ?? label.text ?? ev.title}
                  </span>
                  {tag && <span className="shrink-0 rounded border border-line px-1 text-block-label text-fg-subtle">{tag}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
