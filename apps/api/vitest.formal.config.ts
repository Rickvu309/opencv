import { defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    include: ["src/**/*.formal.test.ts"],
  },
})
