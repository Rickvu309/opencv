import { defineConfig } from "vitest/config"

const manualScriptsNeverInCi = ["src/coach/eval/run.ts", "src/coach/smoke.ts"]
const TYPECHECK_SCRIPT_NOT_VITEST = "src/**/*.type-test.ts"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    testTimeout: 15_000,
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
    globalSetup: ["./src/test/global-setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      TYPECHECK_SCRIPT_NOT_VITEST,
      ...manualScriptsNeverInCi,
    ],
  },
})
