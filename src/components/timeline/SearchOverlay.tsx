"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HIT_MIN } from "@/lib/design/metrics";
import { REGION_LABEL, formatYearL, type Locale, type RegionId, type Strings } from "@/lib/i18n";
import { asYear, loadSearchIndex, search, type SearchHit, type SearchItem } from "@/lib/search";

/**
 * **이름으로 찾기 · 연도로 바로 가기.** PRD §5-10 상단바 도해의 `🔍`와 `[1500 ↵]` 둘 다
 * 여기 있다 — 44px 한 줄에 입력창을 더 넣을 자리가 없어서(열 폭 하한 작업에서 확인) 한 오버레이에
 * 모았다. 입력이 숫자면 연도로 읽고, 아니면 이름으로 찾는다.
 *
 * **색인은 열 때 받는다.** `search.json`은 gzip 256KB로, 첫 화면 데이터가 이미 예산의 다섯 배라
 * 거기에 얹을 수 없다(`src/lib/search.ts`). 두 번째 열기부터는 메모리에 있다.
 *
 * 모달 규약은 상세 패널과 같다 — `role="dialog"` · `aria-modal` · Esc로 닫힘 · 열릴 때 입력에
 * 포커스 · 닫을 때 부른 곳으로 되돌림. 격자에 `inert`를 거는 것은 부모가 한다.
 */
export function SearchOverlay({
  t,
  locale,
  indexUrl,
  dataEndYear,
  onPickYear,
  onPickEvent,
  onClose,
}: {
  t: Strings;
  locale: Locale;
  indexUrl: string;
  dataEndYear: number;
  onPickYear: (year: number) => void;
  onPickEvent: (hit: SearchHit) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /** 열릴 때 한 번. 실패하면 다시 열 때 다시 시도한다(`loadSearchIndex`가 캐시를 비운다). */
  useEffect(() => {
    let live = true;
    loadSearchIndex(indexUrl)
      .then((x) => live && setItems(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [indexUrl]);

  const year = asYear(q, dataEndYear);
  const hits = useMemo(() => (items && q.trim() ? search(items, q) : []), [items, q]);
  /** 연도 줄이 있으면 그것이 0번이다 — 「1592」를 치면 그 해로 가는 것이 첫 뜻이다. */
  const rows = useMemo(
    () => (year !== null ? [{ kind: "year" as const, year }, ...hits.map((h) => ({ kind: "hit" as const, hit: h }))] : hits.map((h) => ({ kind: "hit" as const, hit: h }))),
    [year, hits],
  );

  useEffect(() => setCursor(0), [q]);

  /** 고른 줄이 목록 밖으로 나가지 않게. 키보드로만 움직일 때 화면이 따라와야 한다. */
  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (i: number) => {
    const row = rows[i];
    if (!row) return;
    if (row.kind === "year") onPickYear(row.year);
    else onPickEvent(row.hit);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); choose(cursor); }
  };

  const status = failed
    ? t.searchFailed
    : items === null
      ? t.loading
      : q.trim() && rows.length === 0
        ? t.searchNoResults
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[10vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.search}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-float)]"
        onKeyDown={onKey}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4">
          <span aria-hidden className="text-fg-subtle">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
            className="min-w-0 flex-1 bg-transparent py-3 text-lead outline-none placeholder:text-fg-subtle"
          />
          <button type="button" onClick={onClose} aria-label={t.close} style={{ minWidth: HIT_MIN, minHeight: HIT_MIN }} className="shrink-0 text-fg-subtle hover:text-fg">
            ×
          </button>
        </div>

        {status && <p className="px-4 py-5 text-meta text-fg-subtle">{status}</p>}

        {rows.length > 0 && (
          <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1" style={{ overscrollBehavior: "contain" }}>
            {rows.map((row, i) => (
              <li key={row.kind === "year" ? "y" : row.hit.id}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  onMouseEnter={() => setCursor(i)}
                  aria-current={i === cursor || undefined}
                  className={`flex w-full items-baseline gap-3 px-4 py-2 text-left ${i === cursor ? "bg-surface-hover" : ""}`}
                  style={{ minHeight: HIT_MIN }}
                >
                  {row.kind === "year" ? (
                    <span className="text-item-lead">{t.goToYear(formatYearL(row.year, locale))}</span>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-item-lead">{row.hit.name}</span>
                      <span className="shrink-0 text-item-meta tabular-nums text-fg-subtle">{formatYearL(row.hit.year, locale)}</span>
                      <span className="shrink-0 text-item-meta" style={{ color: `var(--color-region-${row.hit.region})` }}>
                        {REGION_LABEL[locale][row.hit.region as RegionId]}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
