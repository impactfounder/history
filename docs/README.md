# Handoff: 비교 연표 그리드 — 1b「카드 열」

## Overview

`history` 비교 연표의 격자 홈·상세 패널·모바일·연도 페이지를 다시 짠다. 목표는 하나다. **한 자리에서 동시에 말하는 시각 채널을 아홉 개에서 네 개로 줄이는 것.**

지금 화면은 요소가 많아서 지저분한 게 아니다. 같은 픽셀 위에서 (1) 나라색 바탕 헤더, (2) 왕조 배경 농도 3단 교대, (3) 왕조 경계선, (4) 왕조 스티키 라벨, (5) 중요도 티어 3단(크기·굵기·색), (6) 행 격자선, (7) ◆ 표식, (8) `+N`, (9) 이탤릭(전승)이 함께 말한다. 그중 다섯은 서로를 가린다 — 왕조 배경이 글자 대비를 깎고, 나라색 바탕이 왕조 라벨의 색과 겹치고, 행 격자선이 왕조 경계선과 같은 굵기로 싸운다.

1b 이후 남는 채널은 넷이다. **나라 = 헤더의 색과 여백 / 시대 = 서체와 러그 / 사건 = 크기 2단 / 지속 = 세로 범위.**

### 실측 근거 (2026-09-09 발행분, 십년 레벨 착지 화면 1440×860)

| | 값 |
|---|---|
| 화면에 보이는 사건 | 48건 |
| 칸에 못 들어가 `+N`으로 접힌 사건 | 562건 (92%) |
| 한국어 UI인데 영·중 원문 그대로 | 15건 / 48건 = **31%** |
| 셀당 실제 표시 건수 | 한국 1.7 · 중국 1.4 · 일본 1.6 · 미국 2.0 |
| 크롬이 먹는 세로 | 상단바 56 + 줌바 40 = 96px |
| 시간 축이 먹는 가로 | 레일 64 + 연도 거터 56 = 120px |

`rank.tierOf`·`layoutCell`을 실제 청크에 돌려 얻은 값이다. 재현 파일 `Timeline Now.dc.html`이 이 화면을 그대로 옮겨 놓았다.

---

## About the Design Files

이 묶음의 `.dc.html` 파일은 **HTML로 만든 디자인 참조**다. 의도한 모습과 동작을 보여주는 시안이고, 그대로 복사해 넣을 프로덕션 코드가 아니다.

할 일은 이 시안을 **대상 코드베이스의 기존 환경에서 다시 만드는 것**이다. 이 프로젝트는 Next.js 16 (App Router) + React + Tailwind CSS v4 + TypeScript이고, 확립된 규약이 있다:

- 색·치수는 `globals.css`의 3층 토큰(원시 → 역할 → 다크)만 참조한다. 컴포넌트에 hex를 직접 쓰지 않고, `text-neutral-500` 같은 원시 팔레트 클래스도 쓰지 않는다 (`AGENTS.md`).
- 다크는 `dark:` 유틸리티가 아니라 [3]층의 토큰 재대입으로만 한다.
- 좌표 변환은 전부 `src/lib/timeline/axis.ts`에만 있다. 이 파일은 테스트 46개가 물고 있고, **이번 작업에서 한 줄도 바꾸지 않는다.**
- 치수의 원본은 `src/lib/design/metrics.ts`이고 `globals.css`의 `--size-*`는 사본이다. `metrics.test.ts`가 둘의 일치를 강제한다.

시안의 인라인 스타일은 참조용 수치일 뿐이다. 실제 구현은 위 규약대로 토큰과 유틸리티 클래스로 옮긴다.

## Fidelity

**High-fidelity.** 색·서체·치수·문구가 최종값이다. 아래 §Design Tokens와 함께 제공되는 `globals.tokens.css`·`metrics.ts`가 그 값의 원본이다. 픽셀 단위로 맞춰 구현한다.

---

## 다섯 가지 규칙

1. **격자 안은 무채색.** 왕조 배경 농도 교대를 없앤다. 나라색은 열 헤더의 이름과 3px 밑선, 그리고 상세의 관점별 명칭 라벨에만 남는다.
2. **시대는 색이 아니라 서체로.** 왕조·연도 라벨만 명조체(Noto Serif KR)로 두면 배경을 칠하지 않고도 시간 채널이 사건 채널과 분리된다.
3. **위계는 3단에서 2단으로.** 12·13·14px 세 단계를 없애고 **UI 언어로 읽히는 사건 15px/600** / **원문 문장 13px/400 + 언어 태그** 두 단계만 둔다. 등급의 축이 중요도에서 가독성으로 바뀐다 — 자세한 근거는 `item-kind.ts`의 주석에.
4. **레일과 연도 거터를 하나로.** 64 + 56 = 120px을 86px 한 축으로 합친다. 미니맵 10px이 그 안에 들어간다.
5. **크롬은 44px 한 줄.** 상단바 56 + 줌바 40 = 96px을 44px로 줄이고, 줌·중앙 연도·조작 힌트는 격자 오른쪽 아래에 떠 있는 컨트롤로 옮긴다. 격자에 세로 52px, 가로 34px이 돌아온다.

**1b가 1a·1c와 다른 점:** 열을 색이 아니라 **여백으로** 나눈다. 4개 흰 카드가 캔버스(`--color-canvas`) 위에 10px 간격으로 놓이고, 항목은 두 줄(제목 + 메타)을 받는다. 대신 열 폭이 340 → 322px로 줄고 밀도가 조금 떨어진다(셀당 3 → 2건). 세 방향의 맞바꿈은 `Timeline Redesign.dc.html` 하단에 정리돼 있다.

---

## 파일별 변경

### 1. `src/app/(ko)/layout.tsx` 및 `src/app/(intl)/[locale]/layout.tsx`

명조체를 더한다. Pretendard는 지금처럼 npm 패키지의 동적 서브셋 CSS를 쓴다.

```tsx
import { Noto_Serif_KR } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "../globals.css";

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],          // 한글은 next/font가 unicode-range로 나눠 받는다
  weight: ["400", "600"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSerifKr.variable}>
      <body className="h-full overflow-hidden bg-surface text-fg antialiased">{children}</body>
    </html>
  );
}
```

명조체가 붙는 곳은 넷뿐이다: 축의 연도 라벨, 열 헤더의 왕조 이름, 상세 패널의 날짜 줄, 연도 페이지의 `h1`. 본문에는 쓰지 않는다.

### 2. `src/app/globals.css`

`@import "tailwindcss"` 아래 [1]·[2] 블록을 `globals.tokens.css`의 내용으로 갈아 끼운다. 요점:

- 중립 계단이 순수 무채색 → 웜 페이퍼(채도 ≤ 0.004)로 바뀐다.
- `fg-muted #6b6660` = 5.67:1, `fg-subtle #7a746c` = 4.62:1 — 두 단계 모두 흰 바탕 AA 통과. (기존 `fg-subtle #737373`은 4.73:1이었지만 밴드 위에서 3.99:1로 실패했다. 밴드가 없어지니 그 제약도 사라진다.)
- 정치체 밴드 토큰 24개(`--color-region-*-band-*-{c,d,y}`, `-band-edge`, `-label-edge`)를 **전부 삭제**한다. 러그 2톤 + 틱 1개가 대체한다.
- `--font-serif`, `--color-canvas`, `--color-lug-a/-b`, `--color-era-tick`, `--color-span-frame`이 새로 생긴다.
- 타이포 스케일이 `--text-chip`/`--text-chip-lead` 3단 → `--text-item`/`--text-item-lead`/`--text-item-meta` 2단+메타로 바뀐다.

`body`의 `word-break: keep-all`·`text-wrap: pretty`는 그대로 둔다. 한글 고아 줄바꿈 방지는 여전히 필요하다.

### 3. `src/lib/design/metrics.ts`

제공된 `metrics.ts`로 교체한다. `CHIP_H {1:26, 2:22, 3:20}` → `ITEM_H {lead:34, plain:28}`. `BAND_LABEL_H`는 사라지고 `CARD_GAP`·`LUG_W`·`ERA_TICK_W`·`AXIS_W`·`MINIMAP_W`·`MORE_BADGE_BAND`·`MORE_LANE_W`가 생긴다.

`metrics.test.ts`(19개)는 globals.css의 `--size-*` 사본과의 일치를 검사한다. **토큰 이름이 바뀌었으므로 이 테스트를 함께 고쳐야 한다.** 새 `--size-*` 목록은 `globals.tokens.css`에 있다.

### 4. `src/lib/timeline/item-kind.ts` (신규)

제공된 파일 그대로. `itemKind(ev, locale)`이 `"lead" | "plain"`을 낸다. 판정은 세 줄이다 — 표제어가 사건 이름 꼴이거나(`eventLabel().name`), 원문이 이미 UI 언어거나, ko UI에 기계 번역이 있으면 lead.

**의존성 0, DOM 접근 0**의 규약을 지킨다(`axis.ts`·`rank.ts`와 같은 성격). 테스트를 새로 추가할 만하다 — 최소 5케이스: 사건 이름 / 인물 이름 / ko 원문 / en 원문 / title_ko 있는 en 원문.

### 5. `src/lib/timeline/layout-cell.ts` (신규)

`TimelineGrid.tsx` 안에 있던 `layoutCell`을 밖으로 빼서 순수 함수로 만든다. 제공된 파일 그대로. 기존 두 단계(높이 예산 → 시점 위치)는 그대로고, 두 가지가 더해진다:

- 높이가 티어가 아니라 등급에서 나온다(`ITEM_H[kind]`).
- **배지 레인:** 숨은 것이 있을 때, 셀 아래쪽 `MORE_BADGE_BAND`(20px) 띠와 겹치는 항목만 `laneEnd = MORE_LANE_W`(64px)를 받는다. 이 한 줄이 없으면 잘린 글줄 위에 `26건 더` 배지가 겹쳐 찍혀 "…guerrillas in the.3건 더"처럼 읽힌다. 시안 첫 판에서 실제로 6칸 중 5칸이 그랬다.

### 6. `src/lib/i18n.ts`

`i18n.additions.ts`의 항목을 `Strings`와 `T`의 네 언어 모두에 더하고, 거기 적힌 것을 뺀다. 요약: `moreCount`·`originalIn`·`nikhShort`·`zoomHint`·`minimapTitle`을 더하고, `hintTouch`·`hintDesktop`·`hintClose`·`siteHint`·`officialMark`(칩 title 용도)를 뺀다. `localStorage("history:hintSeen")`을 쓰는 코드도 함께 지운다.

### 7. `src/components/timeline/TimelineGrid.tsx`

가장 큰 변경. 순서대로.

#### 7-1. 상단바 (56 → 44px)

```
[history]  1592 1882 1945          11,615건 · 2025년까지  한국어 EN 日 中  출처
```

- 추천 연도: `w-[62px] rounded-full border` 알약 3개 → 밑줄 없는 12.5px `tabular-nums` 텍스트 링크 3개, 간격 16px, `text-fg-subtle`.
- 배지: `ml-auto`로 오른쪽에. `text-fg-subtle`, 12px.
- 언어: `w-7` 사각 버튼 4개 → 12.5px 텍스트. 현재 언어만 `text-fg font-semibold`, 나머지 `text-fg-subtle`. 한국어는 `한국어`, 나머지는 `EN`·`日`·`中`.
- `siteHint`(330px 고정 폭 안내문)는 삭제. 줌 컨트롤로 갔다.
- 「자리 고정」 규약은 유지한다 — 언어를 바꿔도 각 조각의 폭이 변하지 않아야 한다. 배지는 `min-w-0 truncate`, 언어 묶음은 `shrink-0`.

#### 7-2. 시간 축 (레일 64 + 거터 56 → 86px)

축은 두 부분으로 나뉘고, **스크롤 여부가 다르므로 DOM도 나뉜다.**

- **미니맵 10px** — 스크롤러의 형제. 지금의 레일 요소를 그대로 쓰되 폭만 `w-10 wide:w-16` → `w-[10px]`로 줄이고 라벨을 없앤다. 홈 열(첫 열)의 왕조를 `railY()`로 매핑해 무채색 계단으로 칠한다. 톤은 `--color-lug-a`/`--color-lug-b` 두 톤 교대 + 현재 시대만 `--ink-400`보다 한 단 진하게. 뷰포트 창(`railWindow`)은 위아래 1.5px `--color-fg` 선 + `rgb(25 23 19 / 0.08)` 채움. `onPointerDown`의 `jumpFromRail`은 그대로.
- **연도 라벨 76px** — 스크롤러 안, 각 행의 첫 칸(지금의 거터). `w-12 wide:w-14` → `w-[76px]`. 라벨을 **오른쪽 정렬**하고 `font-serif text-axis text-fg-muted whitespace-nowrap`. `formatRowLabelL`은 그대로 쓴다.
- 행 안 보조선 눈금(연·월)은 그대로 둔다. 76px에서 `1930`~`1939`가 여유롭게 들어간다.
- 768px 미만의 모바일 스크러버(16px)는 미니맵과 같은 톤으로 통일한다. 별도 요소로 남긴다.

#### 7-3. 열 카드

핵심 제약: 스크롤 컨테이너가 시간축 그 자체이고(§5-5A) 스페이서 높이가 2만 px을 넘는다. 카드를 스크롤 콘텐츠 안에 두면 둥근 모서리가 축의 양 끝에서만 보인다. 그래서 **카드 테두리는 스크롤하지 않는 프레임 층으로 그린다.**

```
<div class="relative flex min-h-0 flex-1">        ← 기존 중간 영역
  <div class="w-[10px] …">미니맵</div>
  <div class="relative min-w-0 flex-1">
    <div class="absolute inset-0 flex pointer-events-none z-0">   ← 신규: 카드 프레임 층
      <div class="w-[76px] shrink-0" />                            (축 라벨 자리)
      {shown.map(c => (
        <div class="ml-[10px] min-w-0 flex-1 rounded-card border border-line bg-surface" />
      ))}
    </div>
    <div ref={scrollerRef} class="relative z-10 …overflow-y-auto">  ← 기존 스크롤러
      … 스페이서 · 행 · 셀 …
    </div>
  </div>
  … 상세 패널 …
</div>
```

- 프레임 층은 뷰포트 높이에 고정이므로 위아래 모서리가 늘 보인다. `bg-surface`가 흰 카드 면을 만들고, 스크롤러 자체는 배경을 두지 않는다(`bg-transparent`).
- 중간 영역의 배경이 `--color-canvas`가 되어 카드 사이 10px과 카드 밖으로 드러난다.
- 셀(행 안의 각 열)은 프레임과 어긋나지 않게 같은 `ml-[10px]`·`flex-1`을 쓴다. 세로 구분선은 없앤 상태를 유지한다 — 카드 사이 여백이 그 일을 한다.
- 열 헤더(`sticky top-0`, 44px)는 카드의 머리다. 각 헤더 칸을 `bg-surface rounded-t-card border-b border-line`으로 두고 **나라색 바탕을 없앤다.** 대신:
  - 국기 20×14, `opacity-90`
  - 나라 이름 `text-col font-bold tracking-tight`에 `color: var(--color-region-{id})`
  - 그 시점의 왕조 `font-serif text-meta text-fg-muted truncate` (`polityAt`는 그대로)
  - 헤더 아래 3px `background: var(--color-region-{id})` 밑선
- 열 순서 바꾸기(드래그 + `◂ ▸ ×`)는 그대로. 버튼 색만 `text-white/70` → `text-fg-subtle hover:text-fg`로 바꾼다.

#### 7-4. 왕조 — 배경 밴드 삭제, 러그와 틱으로

`bandStyle()`, 밴드 배경 층, 스티키 라벨 층을 **모두 지운다.** 대신 각 카드 안에 두 가지:

- **러그** — `absolute left-0 w-[3px]`, 왕조마다 `top: yearToY(y0)`, `height: (y1−y0)*s`. 색은 인덱스 짝수 `--color-lug-a`, 홀수 `--color-lug-b`. 색이 아니라 명암 두 톤이므로 네 열이 무지개가 되지 않는다.
- **틱** — 왕조가 시작하는 지점에 `left-[3px] w-[20px] border-t border-era-tick`. 전체 폭 실선은 쓰지 않는다 — 시안 첫 판에서 얄타 회담의 메타 줄을 가로질렀다.
- 왕조 **이름**은 열 헤더에만 나온다. 헤더는 sticky이고 `polityAt(뷰포트 상단 연도)`를 보므로 스크롤하면 저절로 바뀐다. 스티키 라벨 층이 필요 없어지는 이유다.
- 러그는 약 40개, 가상화하지 않는다(기존과 동일).

#### 7-5. 항목 (칩 → 두 줄 항목)

```tsx
const { placed, hidden } = layoutCell(evs, h, b, rows.unit, locale);
…
{placed.map(({ ev, kind, top, h: ih, laneEnd }) => {
  const label = eventLabel(ev, locale, dup);
  const meta = [
    ev.y1 !== undefined && ev.y1 > ev.y0 ? `${ev.y0}–${ev.y1}` : "",
    ev.official ? t.nikhShort : "",
    kind === "plain" ? t.originalIn(ev.lang) : "",
  ].filter(Boolean).join(" · ");
  return (
    <button
      key={ev.id} type="button" data-col={c.id} data-b={b}
      style={{ top, height: ih, paddingRight: laneEnd }}
      className={`absolute left-[14px] right-[12px] flex flex-col justify-center gap-px
                  rounded-item text-left hover:bg-surface-hover/60
                  focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus`}
    >
      <span className={`min-w-0 truncate ${kind === "lead"
        ? "text-item-lead font-semibold text-fg"
        : "text-item text-fg-muted"}${ev.hist === "traditional" ? " italic" : ""}`}>
        {label.name ?? label.text}
      </span>
      {meta && <span className="text-item-meta text-fg-subtle tabular-nums">{meta}</span>}
    </button>
  );
})}
{hidden > 0 && (
  <span className="pointer-events-none absolute bottom-[3px] right-[12px] whitespace-nowrap
                   bg-surface px-[3px] text-item-meta text-fg-subtle tabular-nums">
    {t.moreCount(hidden)}
  </span>
)}
```

바뀐 것:

- 크기·굵기가 `tierOfEvent`가 아니라 `kind`에서 나온다.
- **`◆` 글리프가 사라진다.** 국사편찬위원회 출처는 메타 줄에 글자로 나온다. 장식 글리프의 2.59:1 대비 면제도 함께 사라진다.
- 기간 표기(`1950–1953`)가 제목 뒤 인라인이 아니라 메타 줄로 간다.
- `+N` → `N건 더`, `whitespace-nowrap` 필수. `bg-surface/85` → 불투명 `bg-surface`.
- 왼쪽 여백 14px(`ITEM_INSET_START`)은 러그·기간 레인 자리로 그대로 둔다.
- 키보드 이동(`onGridKey`의 `button[data-col]` 탐색)은 선택자가 그대로이므로 손댈 것이 없다.
- `scrollIntoView({block:"nearest"})` 호출은 그대로 둔다 — 기존 동작이다.

#### 7-6. 기간 프레임 (연도 레벨)

층 자체는 남긴다. 색만 `--color-region-{id}-span` → `--color-span-frame`(무채색)으로 바꾼다. `SPAN_MIN_PX`·`assignLanes`·`MAX_LANES`·「티어 3은 프레임을 갖지 못한다」 규칙 전부 그대로. **십년 레벨(s=8)에서는 어차피 한 건도 그려지지 않는다** — 실측에서 기간 사건 전부가 60px 미만이라 텍스트 채널로 떨어진다.

#### 7-7. 줌 바 삭제, 떠 있는 컨트롤

`<footer>` 40px을 지운다. 대신 스크롤러 위에 `absolute right-4 bottom-4 z-20`:

```
[ 1975년 │ 세기 십년 연도 │ Ctrl+휠 ]
```

`bg-surface/95 border border-line-strong rounded-lg px-2 py-1.5 shadow-[var(--shadow-float)]`. 중앙 연도는 `font-serif text-meta text-fg-strong tabular-nums`, 레벨 정류장은 기존 `LEVEL_STOPS`·`zoomCenterTo`를 그대로 쓰고 활성만 `bg-surface-inverse text-fg-inverse`. `Ctrl+휠`은 `text-item-meta text-fg-subtle`.

개발 모드 계측 HUD(`process.env.NODE_ENV === "development"`)는 컨트롤 왼쪽에 그대로 붙여 둔다.

#### 7-8. 첫 방문 힌트 알약 삭제

`hint` state, `dismissHint`, `localStorage("history:hintSeen")`, `matchMedia("(pointer: coarse)")` 전부 삭제. 조작법은 줌 컨트롤에 상시 있다.

---

## 화면

### 격자 홈 — `/`

세 줌 레벨 모두 위 규칙을 공유하고, 행 높이와 표시 개수만 달라진다.

| 레벨 | s | 행 높이 | 항목 예산(80px 기준 환산) | 보조선 |
|---|---|---|---|---|
| 세기 | 2 | 200px | lead 5 / plain 7 | 없음 |
| **십년 (착지)** | **8** | **80px** | **lead 2 / plain 2** | 없음 (h < 200) |
| 연도 | 40 | 40px | lead 1 | 월 눈금 (h ≥ 240에서만, 즉 s ≥ 240) |

착지는 그대로 `LANDING_YEAR = 1980`, `LANDING_S = 8`. 시안은 상단바가 44px로 줄어 뷰포트가 816px이 되고, 첫 행(1930년대)이 44px 헤더에 가리지 않도록 그린 상태다(중앙 연도 1975년). 구현에서는 착지 상수를 바꾸지 말고 기존대로 1980 중앙에 둔다 — 첫 행이 헤더에 반쯤 가리는 것은 원래 동작이다.

`?r=`·`?y=`·`?s=`·`?lang=` URL 왕복, 청크 캐시, 프리페치, 핀치·휠 줌, 폰 열 축소(<360px 1열 · <600px 2열) 전부 그대로.

### 상세 패널

폭 사다리(`<1024` 바텀 시트 · `1024~1440` overlay · `>1440` push)와 데이터 흐름은 그대로. 안쪽만 다시 짠다. `Timeline Redesign.dc.html`의 400×816 아트보드 참조.

- 머리(고정): 날짜·열 `font-serif text-meta text-fg-muted` → 제목 `text-title font-bold`. 닫기 `✕`.
- 본문(스크롤): 출처 블록들. 테두리 상자를 없애고 `border-t border-line` + 20px 여백으로 나눈다. 각 블록의 라벨은 `text-[10.5px] uppercase tracking-[.1em] font-semibold text-fg-subtle` — 「국사편찬위원회 근대사연표」·「위키백과 연표 원문」+`en` 태그·「설명 · 한국어 위키백과」·「이 사건을 부르는 이름」.
- 본문 글자 14.5px / `leading-[1.7]`. 원문(번역 안 된 것)은 `text-fg-strong`.
- 관점별 명칭은 `<table>` → 34px 라벨 + 값의 flex 행. 라벨에만 나라색.
- 발(고정): 「1945년 공식 연표 전체 보기」 버튼 + 출처·라이선스 줄. `bg-surface-sunken`.
- `word-break: keep-all`·`text-wrap: pretty`·`lang` 속성 전부 유지.

### 모바일 390×844

- 상단바 44px: `history` … `한국어` `⌕` `☰`. 추천 연도·배지는 메뉴로 옮긴다. (지금은 이 다섯 조각의 합이 496px여서 390px에서 `출처` 링크가 잘려 나간다.)
- 축 64px = 미니맵 8px + 연도 라벨 56px. 열 2개(kr·cn), 열당 163px.
- 항목: lead 24px / plain 20px 한 줄, 메타 생략. `N건 더` → 숫자만.
- 바텀 시트 396px, `rounded-t-[16px]`, 손잡이 4×36px.
- 타깃 44px(`HIT_COMFORT`) 유지.

### 연도 페이지 — `/y/{year}`

`YearArticle.tsx`. 표 구조(`table-fixed`, 열 = 나라, 한 행)는 그대로 두고 타이포만 정리한다. 1024×816 아트보드 참조.

- `max-w-5xl` 유지, 패딩 44/48px.
- `h1` `font-serif text-h1 font-semibold tracking-[-.02em]` — 「1592년」.
- 요약 한 줄 `text-lead text-fg-strong`, 그 아래 메타 한 줄 `text-meta text-fg-subtle`.
- 열 머리: 나라 이름(나라색, 14.5px bold) 위, 왕조(`font-serif` 11.5px `text-fg-muted`) 아래 — 한 줄에 나란히 두면 「아즈치모모야마 시대」가 줄바꿈된다.
- 그 해 항목: lead `font-semibold`, plain `text-fg-strong` + 언어 태그. `<li>` 간격 7px.
- 앞뒤 2년 문맥은 `border-t border-line-hairline` 아래로 내리고 `text-meta text-fg-subtle`, 연도 접두 `tabular-nums`.
- 수록 범위 밖 열(1592년의 미국)은 「미국 열은 1776년부터 수록한다.」 한 줄.

### 출처 페이지 — `/sources`

이 묶음에 아트보드가 없다. 같은 문서 규칙(명조 제목 + 16px 본문 + `border-line-hairline` 구분선 + 우측 정렬 없는 출처 줄)을 따르면 되고, 그리드 방향이 확정된 지금 시점에 이어서 그릴 수 있다. **필요하면 요청할 것.**

---

## Interactions & Behavior

바뀌지 않는 것 — `axis.ts`의 좌표 규약, 네이티브 스크롤 = 시간 이동, `Ctrl+휠`·핀치 줌(앵커 연도 고정), `+`/`−`/`0` 키, 화살표·PageUp/Down·Home/End, 칩에서 `←→` 옆 열 / `↑↓` 같은 열, `Enter` 상세, `Esc` 닫기 + 포커스 복귀, 같은 항목 재클릭 = 토글, 열 드래그 순서 바꾸기, 미니맵 클릭 점프, URL `replaceState` 300ms 디바운스, 발행 버전 `?v=` 캐시 무효화.

바뀌는 것:

| | 전 | 후 |
|---|---|---|
| 조작 힌트 | 첫 방문 1회 알약 + 상단바 330px 안내문 | 줌 컨트롤 안 `Ctrl+휠` 상시 |
| 줌 컨트롤 | 하단 40px 바 | 격자 위 떠 있는 컨트롤 |
| 왕조 이름 | 스티키 라벨 층(열마다) | 열 헤더(sticky) |
| 접힌 건수 | `+26` | `26건 더` |
| 공식 연표 표시 | `◆` 글리프 + title | 메타 줄 「국사편찬위원회 연표」 |

호버는 `hover:bg-surface-hover/60` 그대로. 선택은 `bg-surface-hover ring-2 ring-selected-ring` 그대로. 포커스 링 `outline-2 outline-offset-1 outline-focus` 그대로.

## State Management

새 state 없음. `hint`·`sheetFull` 중 `hint`만 삭제. `locale`·`cols`·`axis`·`scrollTop`·`level`·`selected`·`officialYear`·`polities`·`manifest`·`dataVersion` 전부 그대로. 데이터 요청 경로(`/data/v1/...`)도 그대로 — **발행 파이프라인은 손대지 않는다.**

## Design Tokens

`globals.tokens.css`와 `metrics.ts`가 원본이다. 요약:

| 역할 | 값 | 흰 바탕 대비 |
|---|---|---|
| 본문 · 사건 이름 | `#191713` | 17.4:1 |
| 보조 본문 | `#56524b` | 8.0:1 |
| 원문 문장 | `#6b6660` | 5.67:1 |
| 메타 | `#7a746c` | 4.62:1 |
| 장식 전용 (텍스트 금지) | `#b6ada0` | 2.6:1 |
| 러그 진한 단 · 기간 프레임 | `#cec8bd` | — |
| 실선 | `#dad5cc` | — |
| 크롬 구분선 · 카드 테두리 | `#eceae4` | — |
| 캔버스 · 실낱 선 | `#f4f2ee` | — |
| 가라앉은 면 | `#fbfaf8` | — |
| 카드 면 | `#ffffff` | — |

나라색은 값이 그대로다: kr `#0047a0` 8.72 · cn `#c8102e` 5.88 · jp `#6d28d9` 7.10 · us `#1f6e43` 6.23 — 흰 바탕에서 전부 AA 통과. 나타나는 곳은 열 헤더 이름 · 3px 밑선 · 상세의 관점별 명칭 라벨 셋뿐이다.

타이포: 사건·UI는 Pretendard, 시대·연도는 Noto Serif KR. 사건 이름 15px/600, 원문 13px/400, 축 라벨 13px serif, 메타 11px, 열 헤더 15px/700, 문서 본문 14.5px/1.7, `h1` 40px serif/600.

치수: 크롬 44 · 축 86 (미니맵 10 + 라벨 76) · 행 80 (십년) · 항목 lead 34 / plain 28 · 항목 간격 2 · 열 헤더 44 · 카드 간격 10 · 카드 반경 10 · 러그 3 · 시대 틱 20 · 배지 레인 64.

## Assets

새 애셋 없음. 국기 SVG 4개(`public/flags/{kr,cn,jp,us}.svg`, 위키미디어 공용)를 20×14로 줄여 `opacity-90`으로 쓴다. 이 묶음의 `flags/`는 시안이 참조하는 사본이다.

## 손대지 않는 것

- `src/lib/timeline/axis.ts` — 테스트 46개. 한 줄도.
- `src/lib/timeline/rank.ts` — 티어는 선별 순서와 기간 프레임 자격에 계속 쓴다. 다만 `bandLevelKey()`는 쓰이지 않게 되므로 삭제 후보다(테스트 18개 중 해당 케이스 정리 필요).
- `tools/*.mjs`, `curation/`, `public/data/` — 발행 포맷·스키마 전부.
- `src/lib/i18n-pages.tsx`, `LocaleNav.tsx`, `metadata.ts`, `sitemap.ts`, `robots.ts`.
- 상세 패널의 데이터 흐름과 `/y`·`/sources`의 라우팅·색인 규약.

## 테스트

| 파일 | 상태 |
|---|---|
| `axis.test.ts` (46) | 그대로 통과해야 한다. 깨지면 잘못 건드린 것이다. |
| `nikh-match.test.ts` (14) | 무관 |
| `i18n.test.ts` (10) | 문구 추가·삭제에 맞춰 갱신 |
| `rank.test.ts` (18) | `bandLevelKey` 케이스 정리 |
| `metrics.test.ts` (19) | **새 토큰 이름·값으로 다시 작성** |
| `item-kind.test.ts` | **신규** — 사건 이름 / 인물 이름 / ko 원문 / en 원문 / title_ko |
| `layout-cell.test.ts` | **신규** — 높이 예산, 시점 위치, 겹침 밀기, 배지 레인 |

`npm run typecheck`도 함께 통과시킨다.

## Files

| 파일 | 무엇 |
|---|---|
| `Timeline Redesign.dc.html` | 세 방향(1a·1b·1c) + 1b 기준 상세·모바일·연도 페이지 + 공통 값. **1b가 채택안이다.** |
| `Timeline Now.dc.html` | 지금 화면 재현. 전후 대조용. |
| `globals.tokens.css` | `globals.css`의 [1]·[2] 블록 교체분 |
| `metrics.ts` | `src/lib/design/metrics.ts` 교체분 |
| `item-kind.ts` | `src/lib/timeline/item-kind.ts` 신규 |
| `layout-cell.ts` | `src/lib/timeline/layout-cell.ts` 신규 |
| `i18n.additions.ts` | `src/lib/i18n.ts`에 더하고 뺄 것 |
| `flags/` | 시안이 참조하는 국기 사본 (원본은 `public/flags/`) |

`.dc.html`은 브라우저에서 바로 열린다. 시안 안의 좌표·색·치수는 실제 발행 청크와 `rank.tierOf`·`layoutCell`로 계산한 값이므로, 구현 결과와 나란히 놓고 비교할 수 있다.
