import { defineConfig } from "oxlint"
import base from "outtrue/configs/base.json" with { type: "json" }
import baseline from "./scripts/design-system/baseline.json" with { type: "json" }

const baselines = baseline as Record<string, Record<string, number>>

const rules = Object.fromEntries(
  Object.keys(baselines).map((rule) => [
    `design-system/${rule}`,
    ["error", { baseline: baselines[rule] }],
  ])
)

export default defineConfig({
  extends: [base],
  categories: { correctness: "off" },
  settings: { "design-system": { primitives: "packages/ui/src/components" } },
  ignorePatterns: [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/dist/**",
    "**/node_modules/**",
  ],
  rules,
})
