import { defineConfig } from "vitest/config"

export default defineConfig({
  // Vitest's node environment resolves through the ssr config.
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    testTimeout: 15_000,
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
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
