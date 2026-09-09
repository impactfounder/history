import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * `@/` 별칭만 맞춘다. tsconfig의 paths와 같은 값이고, Next는 자체적으로 해석하므로
 * 지금까지는 필요가 없었다 — 기존 테스트가 전부 상대 경로였기 때문이다.
 * item-kind.ts·layout-cell.ts가 `@/lib/i18n`·`@/lib/design/metrics`를 쓰면서 필요해졌다.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
