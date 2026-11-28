import { defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    environment: "node",
    passWithNoTests: false,
    testTimeout: 60_000,
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
  },
})
