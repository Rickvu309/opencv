#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { HEX_KEPT, detect, tokenize } from "./lib/design-css-tokens.mjs"

const srcDir = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../apps/web/src"
)
const write = !process.argv.includes("--check")

const featureCss = readdirSync(path.join(srcDir, "features"), {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => file.endsWith(".css"))
  .map((file) => `features/${file.replaceAll("\\", "/")}`)
  .sort()

const problems = []
for (const file of featureCss) {
  const full = path.join(srcDir, file)
  const before = readFileSync(full, "utf8")
  const after =
    /\/design\//.test(file) && !HEX_KEPT.has(file) ? tokenize(before) : before
  if (after !== before) {
    console.log(`${write ? "rewrote" : "would rewrite"} ${file}`)
    if (write) writeFileSync(full, after)
  }
  problems.push(...detect(write ? after : before, file))
}

for (const problem of problems) console.log(problem)
process.exitCode = problems.length > 0 ? 1 : 0
