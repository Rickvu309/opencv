#!/usr/bin/env node
// Write a stable JSON snapshot of one frame in a .pen file.
//   node scripts/pen-snapshot.mjs <pen file> <frame id> <out.json>
// Sections are the frame's direct children, in order. Each section's texts
// are every text node's content in document order: newlines become one space,
// the result is trimmed, and empty strings are dropped.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const [penFile, frameId, outFile] = process.argv.slice(2)

if (!penFile || !frameId || !outFile) {
  console.error(
    "usage: node scripts/pen-snapshot.mjs <pen file> <frame id> <out.json>"
  )
  process.exit(1)
}

const doc = JSON.parse(readFileSync(penFile, "utf8"))

function findNode(node, id) {
  if (node && node.id === id) return node
  const children = node?.children
  if (!Array.isArray(children)) return null
  for (const child of children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

const frame = findNode(doc, frameId)
if (!frame) {
  console.error(`frame not found: ${frameId}`)
  process.exit(1)
}

function collectTexts(node, texts) {
  if (node?.type === "text" && typeof node.content === "string") {
    const text = node.content.replaceAll("\n", " ").trim()
    if (text !== "") texts.push(text)
  }
  const children = node?.children
  if (!Array.isArray(children)) return
  for (const child of children) collectTexts(child, texts)
}

const sections = (Array.isArray(frame.children) ? frame.children : []).map(
  (child) => {
    const texts = []
    collectTexts(child, texts)
    return {
      id: typeof child.id === "string" ? child.id : "",
      name: typeof child.name === "string" ? child.name : "",
      texts,
    }
  }
)

const snapshot = {
  source: {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: frame.id,
    frameName: typeof frame.name === "string" ? frame.name : "",
  },
  sections,
}

mkdirSync(path.dirname(outFile), { recursive: true })
// Format with the repo's prettier so a regenerated snapshot passes the format check unchanged.
const prettier = await import("prettier")
const options = (await prettier.resolveConfig(outFile)) ?? {}
writeFileSync(
  outFile,
  await prettier.format(JSON.stringify(snapshot), {
    ...options,
    filepath: outFile,
  })
)
