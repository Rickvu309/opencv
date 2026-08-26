import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/domain": path.resolve(
        __dirname,
        "../../packages/domain/src/index.ts"
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Home/Paper RTL suites mount the full app. On contended CI the first
    // tests in a file can exceed Vitest's 5s default before the stream settles.
    testTimeout: 15_000,
  },
})
