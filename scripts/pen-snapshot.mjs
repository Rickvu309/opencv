#!/usr/bin/env node
// Write a stable JSON snapshot of one frame in a .pen file.
//   node scripts/pen-snapshot.mjs [--pricing] <pen file> <frame id> <out.json|out.ts> [--assets <dir>] [--root <node id>] [--styles]
// Sections are the frame's direct children, in order. With --root, they are
// the direct children of the resolved descendant with that id instead, and
// source.root records it. Each section's texts
// are every text node's content in document order: newlines become one space,
// the result is trimmed, and empty strings are dropped.
// Nodes with enabled === false are skipped, with their subtree.
// A ref node expands the referenced component. descendants overrides merge
// onto the descendant with that id; a children override replaces its children.
// Each section's fills are the non-solid fill objects in document order
// (shader, image, mesh_gradient, and anything else that is not a plain color).
// With --assets, each recorded shader is copied from <pen dir>/<url> into
// <dir>/<file name>, so the app's shader file is generated from the pen.
// --styles writes <name>.styles.json beside <name>.snapshot.json for any
// frame; its marks also count icon nodes, since app screens draw stage and
// view icons.
// When out.json is named landing.snapshot.json, the same run also writes
// landing.styles.json beside it: each text's content and the fields the pen
// sets, plus inline marks (a non-text child at most 64px on both sides, with
// children of its own, in a frame that also has a text child). A text that
// starts a line in the pen gets startsLine: true.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pricingSnapshot } from "./pen-pricing-snapshot.mjs"

const args = process.argv.slice(2)
const positional = []
let assetsDir = null
let pricing = false
let rootId = null
let stylesFlag = false
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === "--styles") {
    stylesFlag = true
    continue
  }
  if (arg === "--pricing") {
    pricing = true
    continue
  }
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
  if (arg === "--root") {
    const next = args[index + 1]
    if (!next) {
      console.error("usage: --root <node id> needs a node id")
      process.exit(1)
    }
    rootId = next
    index += 1
    continue
  }
  positional.push(arg)
}

const [penFile, frameId, outFile] = positional

if (!penFile || !frameId || !outFile) {
  console.error(
    "usage: node scripts/pen-snapshot.mjs [--pricing] <pen file> <frame id> <out.json|out.ts> [--assets <dir>] [--root <node id>]"
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

function applyDescendants(root, descendants) {
  if (!descendants || typeof descendants !== "object") return
  for (const [id, override] of Object.entries(descendants)) {
    if (!override || typeof override !== "object") continue
    const ids = id.split("/")
    let target = root
    for (const part of ids) {
      target = findNode(target, part)
      if (!target) break
    }
    target ??= findNode(root, ids.at(-1))
    if (!target) continue
    Object.assign(target, structuredClone(override))
  }
}

function resolveNode(node, stack) {
  if (!node || typeof node !== "object") return null
  if (node.type === "ref" && typeof node.ref === "string") {
    if (stack.has(node.ref)) return null
    const component = findNode(doc, node.ref)
    if (!component) return null
    stack.add(node.ref)
    const expanded = withChildren(component, stack)
    const { ref, type, descendants, ...own } = node
    Object.assign(expanded, own)
    delete expanded.reusable
    applyDescendants(expanded, descendants)
    const resolved = withChildren(expanded, stack)
    stack.delete(node.ref)
    return resolved
  }
  return withChildren(node, stack)
}

function visibleTree(node) {
  if (!node || node.enabled === false) return null
  if (Array.isArray(node.children))
    node.children = node.children.map(visibleTree).filter(Boolean)
  return node
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

function resolveFill(fill) {
  let value = fill
  for (let hop = 0; hop < 4; hop++) {
    if (typeof value !== "string" || !value.startsWith("$")) break
    const entry = doc.variables?.[value.slice(1)]
    value = entry && typeof entry === "object" ? entry.value : entry
  }
  if (typeof value !== "string") return null
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value.trim())
  if (!match) return value
  return `#${match[1].toUpperCase()}`
}

function resolveNumber(value) {
  let current = value
  for (let hop = 0; hop < 4; hop++) {
    if (typeof current !== "string" || !current.startsWith("$")) break
    const entry = doc.variables?.[current.slice(1)]
    current = entry && typeof entry === "object" ? entry.value : entry
  }
  return typeof current === "number" ? current : null
}

function isVerticalFrame(node) {
  return node?.type === "frame" && node.layout === "vertical"
}

// Horizontal frames omit layout. Line 1 of the statement is one of those rows.
function isRowFrame(node) {
  return (
    node?.type === "frame" &&
    (node.layout == null || node.layout === "horizontal")
  )
}

function textStartsLine(node, ancestors) {
  const parent = ancestors[ancestors.length - 1]
  if (isVerticalFrame(parent) && (parent.children ?? [])[0] !== node) {
    return true
  }
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    if (!isRowFrame(ancestors[index])) continue
    const rowParent = ancestors[index - 1]
    const firstOfVertical =
      isVerticalFrame(rowParent) &&
      (rowParent.children ?? [])[0] === ancestors[index]
    return !firstOfVertical
  }
  return false
}

function collectStyleTexts(node, texts, ancestors) {
  if (node?.type === "text" && typeof node.content === "string") {
    const content = node.content.replaceAll("\n", " ").trim()
    if (content !== "") {
      const entry = {
        content,
        fill: resolveFill(node.fill),
        fontSize: resolveNumber(node.fontSize),
        lineHeight: resolveNumber(node.lineHeight),
        fontWeight: node.fontWeight == null ? null : String(node.fontWeight),
        letterSpacing: resolveNumber(node.letterSpacing),
      }
      if (textStartsLine(node, ancestors)) entry.startsLine = true
      texts.push(entry)
    }
  }
  const children = node?.children
  if (!Array.isArray(children)) return
  const next = ancestors.concat(node)
  for (const child of children) collectStyleTexts(child, texts, next)
}

// A mark is the small symbol that sits in a line of text: Nav, Statement, Footer.
// Spacer frames and empty icon boxes have no children, so they are not marks.
function collectMarks(node, marks, icons) {
  const children = node?.children
  if (!Array.isArray(children)) return
  const besideText =
    node?.type === "frame" && children.some((child) => child?.type === "text")
  for (const child of children) {
    const width = child?.width
    const height = child?.height
    const drawn =
      (Array.isArray(child?.children) && child.children.length > 0) ||
      (icons && child?.type === "icon")
    if (
      besideText &&
      child?.type !== "text" &&
      typeof width === "number" &&
      typeof height === "number" &&
      width <= 64 &&
      height <= 64 &&
      drawn
    ) {
      marks.push({
        id: typeof child.id === "string" ? child.id : "",
        name: typeof child.name === "string" ? child.name : "",
        width,
        height,
      })
    }
    collectMarks(child, marks, icons)
  }
}

const frame = visibleTree(resolveNode(requested, new Set()))
if (!frame) {
  console.error(`frame not found: ${frameId}`)
  process.exit(1)
}

let sectionRoot = frame
if (rootId) {
  const found = findNode(frame, rootId)
  if (!found) {
    console.error(`root not found in ${frameId}: ${rootId}`)
    process.exit(1)
  }
  sectionRoot = found
}

const shaderUrls = []
function textSnapshot(sourceFrame) {
  const sections = (
    Array.isArray(sourceFrame.children) ? sourceFrame.children : []
  ).map((child) => {
    const texts = []
    const fills = []
    collect(child, texts, fills)
    for (const fill of fills) {
      if (fill.type === "shader" && typeof fill.url === "string")
        shaderUrls.push(fill.url)
    }
    return {
      id: typeof child.id === "string" ? child.id : "",
      name: typeof child.name === "string" ? child.name : "",
      texts,
      fills,
    }
  })
  const source = sourceOf(requested)
  return { source: rootId ? { ...source, root: rootId } : source, sections }
}

function sourceOf(sourceFrame) {
  return {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: sourceFrame.id,
    frameName: typeof sourceFrame.name === "string" ? sourceFrame.name : "",
  }
}

let snapshot
if (pricing) {
  try {
    snapshot = pricingSnapshot(frame)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
} else {
  snapshot = textSnapshot(sectionRoot)
}

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

mkdirSync(path.dirname(outFile), { recursive: true })
const prettier = await import("prettier")
const options = (await prettier.resolveConfig(outFile)) ?? {}
const json = JSON.stringify(snapshot)
const body = outFile.endsWith(".ts")
  ? `// Generated by scripts/pen-snapshot.mjs from opencv.pen --pricing. Do not edit by hand.\nexport const pricingSnapshot = ${json} as const\n`
  : json
writeFileSync(
  outFile,
  await prettier.format(body, {
    ...options,
    filepath: outFile,
  })
)

const landing = path.basename(outFile) === "landing.snapshot.json"
if (landing || stylesFlag) {
  const borders = []
  function collectBorders(node) {
    if (node.stroke != null) {
      borders.push({
        id: node.id,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth ?? null,
      })
    }
    for (const child of node.children ?? []) collectBorders(child)
  }
  collectBorders(sectionRoot)
  const paints = []
  function paintValue(value, depth = 0) {
    if (value && typeof value === "object" && value.enabled === false)
      return undefined
    if (typeof value === "string" && value.startsWith("$") && depth < 4) {
      const entry = doc.variables?.[value.slice(1)]
      const resolved = entry && typeof entry === "object" ? entry.value : entry
      return resolved == null ? value : paintValue(resolved, depth + 1)
    }
    if (Array.isArray(value))
      return value
        .map((item) => paintValue(item, depth))
        .filter((item) => item !== undefined)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, item]) => [key, paintValue(item, depth)])
          .filter(([, item]) => item !== undefined)
      )
    return value
  }
  function collectPaints(node, nodePath = "") {
    const properties = {}
    for (const key of ["fill", "stroke", "effect"]) {
      const value = paintValue(node[key])
      if (value !== undefined) properties[key] = value
    }
    if (Object.keys(properties).length > 0)
      paints.push({ id: node.id, path: nodePath, ...properties })
    for (const [index, child] of (node.children ?? []).entries())
      collectPaints(child, `${nodePath}/children/${index}`)
  }
  collectPaints(sectionRoot)
  const styleSections = (
    Array.isArray(sectionRoot.children) ? sectionRoot.children : []
  ).map((child) => {
    const texts = []
    const marks = []
    collectStyleTexts(child, texts, [])
    collectMarks(child, marks, !landing)
    return {
      id: typeof child.id === "string" ? child.id : "",
      name: typeof child.name === "string" ? child.name : "",
      texts,
      marks,
    }
  })
  const stylesFile = landing
    ? path.join(path.dirname(outFile), "landing.styles.json")
    : outFile.replace(/(\.snapshot)?\.json$/, ".styles.json")
  const stylesOptions = (await prettier.resolveConfig(stylesFile)) ?? options
  writeFileSync(
    stylesFile,
    await prettier.format(
      JSON.stringify({
        source: rootId
          ? { ...sourceOf(requested), root: rootId }
          : sourceOf(requested),
        sections: styleSections,
        borders,
        paints,
      }),
      { ...stylesOptions, filepath: stylesFile }
    )
  )
}
