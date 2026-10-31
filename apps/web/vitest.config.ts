import path from "path"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

import { quarantine } from "./vitest.quarantine"

import { applyLocalApiUrl } from "./local-env"

applyLocalApiUrl("test")

// First-load assertions and module mocks need fresh import graphs. Mocks can
// leave cached lazy-route consumers bound to a mocked router or another context.
const ISOLATED_FILES = [
  "src/router-lazy.test.tsx",
  "src/features/coach/coach-workspace.test.tsx",
  "src/features/coach/coach-workspace-progress.test.tsx",
  "src/features/paper/cv-photo.test.tsx",
  "src/features/paper/paper-share.test.tsx",
  "src/features/paper/paper-v2-preview.test.tsx",
  "src/features/paper/paper-library.test.tsx",
  "src/features/paper/paper-letter-start-parity.test.tsx",
  "src/features/paper/paper-letter-drafting-parity.test.tsx",
  "src/features/app-shell/app-shell.test.tsx",
  "src/features/apply/apply-board-drop.test.tsx",
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
    // Drain setup-owned routers/queries before file hooks restore fetch stubs.
    sequence: { hooks: "list" },
    // Home/Paper RTL suites mount the full app. On contended CI the first
    // tests in a file can exceed Vitest's 5s default before the stream settles.
    testTimeout: 15_000,
    // Vitest 5: maxWorkers is the pool size. poolOptions was removed.
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
    projects: [
      {
        extends: true,
        test: {
          name: "shared-modules",
          isolate: false,
          exclude: [
            ...configDefaults.exclude,
            ...quarantine.map((entry) => entry.file),
            ...ISOLATED_FILES,
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "isolated",
          isolate: true,
          include: ISOLATED_FILES,
          exclude: quarantine.map((entry) => entry.file),
        },
      },
    ],
  },
})
