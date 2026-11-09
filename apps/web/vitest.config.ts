import path from "path"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

import { quarantine } from "./vitest.quarantine"

import { applyLocalApiUrl } from "./local-env"

applyLocalApiUrl("test")

const ISOLATED_FILES = [
  "src/features/landing/landing-redirect-warmup.test.ts",
  "src/features/app-shell/app-shell-warmup.test.ts",
  "src/router-lazy.test.tsx",
  "src/features/connections/connections.test.tsx",
  "src/features/coach/coach-workspace.test.tsx",
  "src/features/coach/coach-draft-ownership.test.tsx",
  "src/features/coach/coach-workspace-progress.test.tsx",
  "src/features/paper/paper-letter.test.tsx",
  "src/features/paper-page/canvas-mount.test.tsx",
  "src/features/paper-page/canvas-package.test.tsx",
  "src/features/paper/paper-letter-print.test.tsx",
  "src/features/paper/paper-letter-start-context.test.tsx",
  "src/features/paper/paper-letter-start-draft.test.tsx",
  "src/features/paper/paper-letter-edited.test.tsx",
  "src/lib/paper-sync-tabs.test.tsx",
  "src/lib/paper-sync-stuck.test.ts",
  "src/lib/paper-local-replay.test.ts",
  "src/features/paper/cv-photo.test.tsx",
  "src/features/paper/paper-share.test.tsx",
  "src/features/paper/paper-v2-preview.test.tsx",
  "src/features/paper/paper-library.test.tsx",
  "src/features/paper/paper-letter-start-parity.test.tsx",
  "src/features/paper/paper-letter-drafting-parity.test.tsx",
  "src/features/paper/paper-letter-editor-parity.test.tsx",
  "src/features/app-shell/app-shell.test.tsx",
  "src/features/apply/apply-board-drop.test.tsx",
  "src/features/apply/apply-board-queue.test.tsx",
  "src/local-env.test.ts",
]

const DROP_FETCH_STUBS_BETWEEN_FILES_THAT_SHARE_A_MODULE_GRAPH = true
const DRAIN_SETUP_OWNED_ROUTERS_BEFORE_FILE_HOOKS = "list" as const
const FULL_APP_MOUNT_TIMEOUT_PAST_THE_FIVE_SECOND_DEFAULT_MS = 15_000
const VITEST_5_POOL_SIZE = Number(process.env.VITEST_MAX_WORKERS ?? 2)

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
    unstubGlobals: DROP_FETCH_STUBS_BETWEEN_FILES_THAT_SHARE_A_MODULE_GRAPH,
    sequence: { hooks: DRAIN_SETUP_OWNED_ROUTERS_BEFORE_FILE_HOOKS },
    testTimeout: FULL_APP_MOUNT_TIMEOUT_PAST_THE_FIVE_SECOND_DEFAULT_MS,
    maxWorkers: VITEST_5_POOL_SIZE,
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
