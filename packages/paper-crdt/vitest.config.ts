import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  ssr: { resolve: { conditions: ["opencv-source"] } },
  test: {
    environment: "node",
    passWithNoTests: false,
    testTimeout: 15_000,
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2),
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          exclude: [
            ...configDefaults.exclude,
            "src/native-formatting-engine.test.ts",
            "src/native-formatting-mount.test.ts",
            "src/native-layout-mount.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "formatting-engine",
          root: new URL("../../apps/web", import.meta.url).pathname,
          environment: "jsdom",
          include: [
            "../../packages/paper-crdt/src/native-formatting-engine.test.ts",
            "../../packages/paper-crdt/src/native-formatting-mount.test.ts",
            "../../packages/paper-crdt/src/native-layout-mount.test.ts",
          ],
        },
      },
    ],
  },
})
