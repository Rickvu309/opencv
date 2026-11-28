import path from "path"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

import { quarantine } from "./vitest.quarantine"

import { domainEntryAliases } from "./domain-entries"
import { applyLocalApiUrl } from "./local-env"

applyLocalApiUrl("test")

const ISOLATED_FILES = ["**/*.isolated.test.{ts,tsx}"]
const REAL_BROWSER_FILES = ["**/*.browser.test.ts"]
const REAL_BROWSER_TIMEOUT_MS = 120_000

const DROP_FETCH_STUBS_BETWEEN_FILES_THAT_SHARE_A_MODULE_GRAPH = true
const DRAIN_SETUP_OWNED_ROUTERS_BEFORE_FILE_HOOKS = "list" as const
const FULL_APP_MOUNT_TIMEOUT_PAST_THE_FIVE_SECOND_DEFAULT_MS = 15_000
const VITEST_5_POOL_SIZE = Number(process.env.VITEST_MAX_WORKERS ?? 2)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@workspace/domain/internal/paper-presentation": path.resolve(
        __dirname,
        "../../packages/domain/src/paper-doc/paper-presentation.ts"
      ),
      "@": path.resolve(__dirname, "./src"),
      ...domainEntryAliases(__dirname),
      "@workspace/paper-engine": path.resolve(
        __dirname,
        "../../packages/paper-engine/src/index.ts"
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
            ...REAL_BROWSER_FILES,
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "isolated",
          isolate: true,
          include: ISOLATED_FILES,
          exclude: [...quarantine.map((entry) => entry.file)],
        },
      },
      {
        test: {
          name: "real-browser",
          environment: "node",
          include: REAL_BROWSER_FILES.map((glob) => `src/${glob}`),
          testTimeout: REAL_BROWSER_TIMEOUT_MS,
        },
      },
    ],
  },
})
