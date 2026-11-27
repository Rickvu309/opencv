import { defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    environment: "node",
    passWithNoTests: false,
    testTimeout: 180_000,
    fileParallelism: false,
  },
})
