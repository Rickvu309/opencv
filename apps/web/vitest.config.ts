import path from "path"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

import { applyLocalApiUrl } from "./local-env"

applyLocalApiUrl("test")

// These files assert first-load module state, so each needs a fresh module graph.
const ISOLATED_FILES = [
  "src/router-lazy.test.tsx",
  "src/features/paper/paper-library.test.tsx",
  "src/routes/app-shell.test.tsx",
]

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
    // Files share one module graph (isolate: false below); drop fetch stubs between files.
    unstubGlobals: true,
    // Home/Paper RTL suites mount the full app. On contended CI the first
    // tests in a file can exceed Vitest's 5s default before the stream settles.
    testTimeout: 15_000,
    projects: [
      {
        extends: true,
        test: {
          name: "shared-modules",
          isolate: false,
          exclude: [...configDefaults.exclude, ...ISOLATED_FILES],
        },
      },
      {
        extends: true,
        test: { name: "isolated", isolate: true, include: ISOLATED_FILES },
      },
    ],
  },
})
