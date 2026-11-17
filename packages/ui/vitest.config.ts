import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
  },
})
