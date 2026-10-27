import { defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    testTimeout: 15_000,
    globalSetup: ["./src/test/global-setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Manual eval CLI and live Railway smoke — never vitest, never CI.
      "src/coach/eval/run.ts",
      "src/coach/smoke.ts",
    ],
  },
})
