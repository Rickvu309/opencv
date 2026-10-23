import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    testTimeout: 15_000,
    globalSetup: ["./src/test/global-setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Formal checks run through `pnpm --filter api test:formal`.
      "**/*.formal.test.ts",
      // Manual eval CLI and live Railway smoke — never vitest, never CI.
      "src/coach/eval/run.ts",
      "src/coach/smoke.ts",
    ],
  },
})
