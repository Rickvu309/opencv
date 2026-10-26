#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { buildKit } from "../src/build.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const rawPath = join(root, "data", "kit-raw.json")
const outPath = join(root, "data", "kit.json")

if (!existsSync(rawPath)) {
  if (existsSync(outPath)) process.exit(0)
  console.error("data/kit-raw.json is missing. Run `opencv sync <file>` first.")
  process.exit(1)
}
const kit = buildKit(JSON.parse(readFileSync(rawPath, "utf8")))
writeFileSync(outPath, JSON.stringify(kit, null, 1) + "\n")
console.log(
  `kit.json: ${kit.components.length} components, ${kit.components.reduce((n, c) => n + c.variants.length, 0)} masters, ${Object.keys(kit.tokens).length} tokens, ${kit.screens.length} screens`
)
