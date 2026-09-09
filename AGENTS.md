<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 디자인 토큰 규칙

색·치수·타이포는 `src/app/globals.css`의 토큰으로만 참조한다. 세 가지를 하지 않는다.

1. **hex·`rgba()`·`oklch()`를 컴포넌트에 직접 쓰지 않는다** — 토큰을 참조한다.
2. **원시 팔레트 클래스를 쓰지 않는다** (`text-neutral-500`, `bg-white`, `border-neutral-200` 등)
   — 역할 토큰을 쓴다(`text-fg-muted`, `bg-surface`, `border-line`).
3. **`dark:` 유틸리티를 쓰지 않는다** — 다크는 globals.css `[3]` 블록의 토큰 재대입으로만 한다.
   한 번 허용하면 다크 팔레트가 100곳에 흩어져 그 블록의 의미가 사라진다.

토큰 층은 3단이다: `[1] :root` 원시(유틸리티 없음) → `[2] @theme` 역할(유틸리티 생성) →
`[3]` 다크에서 [2]의 이름에 다른 [1] 값을 재대입. 인라인 `var()`로만 쓰는 파생값
(`--color-region-*-band-*`)은 `@theme` 밖 `:root`에 둔다 — Tailwind v4가 `@theme`의 미사용
토큰을 트리셰이킹으로 지우기 때문이다.

**대비 규칙**: `text-fg-subtle`(ink-500)은 흰 배경 4.73:1로 통과하지만 정치체 띠 위에서는
3.99:1로 실패한다. **띠 위에서는 `text-fg-muted`**(ink-600, 띠 위 6.57:1).

치수는 `src/lib/design/metrics.ts`가 원본이고 globals.css의 `--size-*`가 사본이다.
`metrics.test.ts`가 둘의 일치를 강제한다 — 한쪽만 고치면 `npm test`가 깨진다.
이 레포에는 eslint가 없고(`next lint`는 Next 16에서 제거됐다) 게이트가 vitest·tsc뿐이라,
규칙은 테스트로 만들어야 실제로 돈다.
