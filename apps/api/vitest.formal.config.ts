import { defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    include: ["src/**/*.formal.test.ts"],
    testTimeout: 15_000,
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
  },
})
