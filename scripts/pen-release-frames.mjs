#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"

const [penFile, outFile] = process.argv.slice(2)
if (!penFile || !outFile) {
  console.error(
    "usage: node scripts/pen-release-frames.mjs <pen file> <out.json>"
  )
  process.exit(1)
}

const doc = JSON.parse(readFileSync(penFile, "utf8"))
const top = doc.children ?? []

function markerY(prefix) {
  const marker = top.find((node) => String(node.name ?? "").startsWith(prefix))
  if (!marker) {
    console.error(`marker not found: ${prefix}`)
    process.exit(1)
  }
  return marker.y
}

const firstReleaseStartY = markerY("Part 2 First release")
const backlogStartY = markerY("Part 3 Backlog")
const WORKFLOW_STATE_OR_MARKETING_PAGE_NAME = /^W\d+\.\d+ |\(Linear layout\)$/

const frames = top
  .filter(
    (node) =>
      node.enabled !== false &&
      node.y >= firstReleaseStartY &&
      node.y < backlogStartY &&
      WORKFLOW_STATE_OR_MARKETING_PAGE_NAME.test(String(node.name ?? ""))
  )
  .map((node) => ({ id: node.id, name: node.name }))
  .sort((left, right) =>
    left.name.localeCompare(right.name, "en", { numeric: true })
  )

const out = {
  source: {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
  },
  frames,
}
writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`)
console.log(`${frames.length} release frames -> ${outFile}`)
