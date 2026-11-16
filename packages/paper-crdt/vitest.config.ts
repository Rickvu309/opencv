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
            "src/native-layout-formatting.test.ts",
            "src/native-photo-mount.test.ts",
            "src/rich-editor.test.ts",
            "src/rich-tables.test.ts",
            "src/rich-style-parity.test.ts",
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
            "../../packages/paper-crdt/src/native-layout-formatting.test.ts",
            "../../packages/paper-crdt/src/native-photo-mount.test.ts",
            "../../packages/paper-crdt/src/rich-editor.test.ts",
            "../../packages/paper-crdt/src/rich-tables.test.ts",
            "../../packages/paper-crdt/src/rich-style-parity.test.ts",
          ],
        },
      },
    ],
  },
})
