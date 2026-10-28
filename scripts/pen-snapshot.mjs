#!/usr/bin/env node
// Write a stable JSON snapshot of one frame in a .pen file.
//   node scripts/pen-snapshot.mjs <pen file> <frame id> <out.json> [--assets <dir>]
// Sections are the frame's direct children, in order. Each section's texts
// are every text node's content in document order: newlines become one space,
// the result is trimmed, and empty strings are dropped.
// Nodes with enabled === false are skipped, with their subtree.
// A ref node expands the referenced component. descendants overrides merge
// onto the descendant with that id; a children override replaces its children.
// Each section's fills are the non-solid fill objects in document order
// (shader, image, mesh_gradient, and anything else that is not a plain color).
// With --assets, each recorded shader is copied from <pen dir>/<url> into
// <dir>/<file name>, so the app's shader file is generated from the pen.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const positional = []
let assetsDir = null
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === "--assets") {
    const next = args[index + 1]
    if (!next) {
      console.error("usage: --assets <dir> needs a directory")
      process.exit(1)
    }
    assetsDir = next
    index += 1
    continue
  }
  positional.push(arg)
}

const [penFile, frameId, outFile] = positional

if (!penFile || !frameId || !outFile) {
  console.error(
    "usage: node scripts/pen-snapshot.mjs <pen file> <frame id> <out.json> [--assets <dir>]"
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

const requested = findNode(doc, frameId)
if (!requested) {
  console.error(`frame not found: ${frameId}`)
  process.exit(1)
}

function indexNodes(node, map) {
  if (!node || typeof node !== "object") return
  if (typeof node.id === "string") map.set(node.id, node)
  const children = node.children
  if (!Array.isArray(children)) return
  for (const child of children) indexNodes(child, map)
}

function applyDescendants(root, descendants) {
  if (!descendants || typeof descendants !== "object") return
  const map = new Map()
  indexNodes(root, map)
  for (const [id, override] of Object.entries(descendants)) {
    if (!override || typeof override !== "object") continue
    const target = map.get(id)
    if (!target) continue
    const { children, ...rest } = override
    Object.assign(target, rest)
    if (Array.isArray(children)) {
      target.children = children
      for (const child of children) indexNodes(child, map)
    }
  }
}

function resolveNode(node, stack) {
  if (!node || typeof node !== "object") return null
  if (node.enabled === false) return null
  if (node.type === "ref" && typeof node.ref === "string") {
    if (stack.has(node.ref)) return null
    const component = findNode(doc, node.ref)
    if (!component || component.enabled === false) return null
    const expanded = structuredClone(component)
    applyDescendants(expanded, node.descendants)
    if (expanded.enabled === false) return null
    stack.add(node.ref)
    const resolved = withChildren(expanded, stack)
    stack.delete(node.ref)
    return resolved
  }
  return withChildren(node, stack)
}

function withChildren(node, stack) {
  const copy = { ...node }
  if (Array.isArray(node.children)) {
    const children = []
    for (const child of node.children) {
      const resolved = resolveNode(child, stack)
      if (resolved) children.push(resolved)
    }
    copy.children = children
  }
  return copy
}

function plainColor(fill) {
  return fill.type === "color" || fill.type === "solid"
}

function nonSolidFills(fill) {
  const list = Array.isArray(fill) ? fill : [fill]
  const found = []
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    if (item.enabled === false) continue
    if (typeof item.type !== "string" || plainColor(item)) continue
    found.push(structuredClone(item))
  }
  return found
}

function collect(node, texts, fills) {
  if (!node || typeof node !== "object") return
  if (node.type === "text" && typeof node.content === "string") {
    const text = node.content.replaceAll("\n", " ").trim()
    if (text !== "") texts.push(text)
  }
  fills.push(...nonSolidFills(node.fill))
  const children = node.children
  if (!Array.isArray(children)) return
  for (const child of children) collect(child, texts, fills)
}

const frame = resolveNode(requested, new Set())
if (!frame) {
  console.error(`frame not found: ${frameId}`)
  process.exit(1)
}

const shaderUrls = []
const sections = (Array.isArray(frame.children) ? frame.children : []).map(
  (child) => {
    const texts = []
    const fills = []
    collect(child, texts, fills)
    for (const fill of fills) {
      if (fill.type === "shader" && typeof fill.url === "string") {
        shaderUrls.push(fill.url)
      }
    }
    return {
      id: typeof child.id === "string" ? child.id : "",
      name: typeof child.name === "string" ? child.name : "",
      texts,
      fills,
    }
  }
)

if (assetsDir) {
  const penDir = path.dirname(path.resolve(penFile))
  const destDir = path.resolve(assetsDir)
  const seen = new Set()
  for (const url of shaderUrls) {
    if (seen.has(url)) continue
    seen.add(url)
    const from = path.resolve(penDir, url)
    const to = path.join(destDir, path.basename(url))
    mkdirSync(path.dirname(to), { recursive: true })
    copyFileSync(from, to)
  }
}

const snapshot = {
  source: {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: requested.id,
    frameName: typeof requested.name === "string" ? requested.name : "",
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
