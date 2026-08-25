import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Manual eval CLI — never vitest, never CI. Unit tests in this folder stay included.
      "src/coach/eval/run.ts",
    ],
  },
})
