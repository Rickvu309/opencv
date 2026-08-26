import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Manual eval CLI and live Railway smoke — never vitest, never CI.
      "src/coach/eval/run.ts",
      "src/coach/smoke.ts",
    ],
  },
})
