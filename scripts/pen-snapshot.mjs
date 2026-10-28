#!/usr/bin/env node
// Write a stable JSON snapshot of one frame in a .pen file.
//   node scripts/pen-snapshot.mjs [--pricing] <pen file> <frame id> <out.json|out.ts> [--assets <dir>]
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
// When out.json is named landing.snapshot.json, the same run also writes
// landing.styles.json beside it: each text's content and the fields the pen
// sets, plus inline marks (a non-text child at most 64px on both sides, with
// children of its own, in a frame that also has a text child).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const positional = []
let assetsDir = null
let pricing = false
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
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
  positional.push(arg)
}

const [penFile, frameId, outFile] = positional

if (!penFile || !frameId || !outFile) {
  console.error(
    "usage: node scripts/pen-snapshot.mjs [--pricing] <pen file> <frame id> <out.json|out.ts> [--assets <dir>]"
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

function collectStyleTexts(node, texts) {
  if (node?.type === "text" && typeof node.content === "string") {
    const content = node.content.replaceAll("\n", " ").trim()
    if (content !== "") {
      texts.push({
        content,
        fill: resolveFill(node.fill),
        fontSize: typeof node.fontSize === "number" ? node.fontSize : null,
        lineHeight:
          typeof node.lineHeight === "number" ? node.lineHeight : null,
        fontWeight: node.fontWeight == null ? null : String(node.fontWeight),
        letterSpacing:
          typeof node.letterSpacing === "number" ? node.letterSpacing : null,
      })
    }
  }
  const children = node?.children
  if (!Array.isArray(children)) return
  for (const child of children) collectStyleTexts(child, texts)
}

// A mark is the small symbol that sits in a line of text: Nav, Statement, Footer.
// Spacer frames and empty icon boxes have no children, so they are not marks.
function collectMarks(node, marks) {
  const children = node?.children
  if (!Array.isArray(children)) return
  const besideText =
    node?.type === "frame" && children.some((child) => child?.type === "text")
  for (const child of children) {
    const width = child?.width
    const height = child?.height
    if (
      besideText &&
      child?.type !== "text" &&
      typeof width === "number" &&
      typeof height === "number" &&
      width <= 64 &&
      height <= 64 &&
      Array.isArray(child.children) &&
      child.children.length > 0
    ) {
      marks.push({
        id: typeof child.id === "string" ? child.id : "",
        name: typeof child.name === "string" ? child.name : "",
        width,
        height,
      })
    }
    collectMarks(child, marks)
  }
}

const frame = resolveNode(requested, new Set())
if (!frame) {
  console.error(`frame not found: ${frameId}`)
  process.exit(1)
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
  return { source: sourceOf(requested), sections }
}

function sourceOf(sourceFrame) {
  return {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: sourceFrame.id,
    frameName: typeof sourceFrame.name === "string" ? sourceFrame.name : "",
  }
}

const EN_DASH = "\u2013"
const BANNED_CELL_TEXT = new Set(["Included", "Not included", "Coming soon"])

function fail(message) {
  throw new Error(`pricing snapshot: ${message}`)
}

function padTop(node) {
  const pad = node?.padding
  if (typeof pad === "number") return pad
  if (Array.isArray(pad) && typeof pad[0] === "number") return pad[0]
  return 0
}

function isSpacer(node) {
  return (
    node?.type === "frame" &&
    node.width === 1 &&
    typeof node.height === "number" &&
    (node.children == null || node.children.length === 0)
  )
}

function trimmed(node) {
  if (node?.type !== "text" || typeof node.content !== "string") return null
  return node.content.replaceAll("\n", " ").trim()
}

function columnOf(section) {
  const column = (section.children ?? []).find((child) => child.width === 880)
  if (!column) fail(`${section.name} has no 880 column`)
  return column
}

function sameNumber(label, values) {
  if (
    values.length === 0 ||
    values.some((value) => typeof value !== "number")
  ) {
    fail(`${label} is missing`)
  }
  const [first] = values
  if (values.some((value) => value !== first)) {
    fail(`${label} disagrees: ${values.join(", ")}`)
  }
  return first
}

function surfaceOf(fill, id) {
  if (fill && typeof fill === "object" && fill.type === "mesh_gradient") {
    return "mesh"
  }
  if (fill === "#FFFFFF") return "paper"
  fail(`${id} fill is not paper or mesh`)
}

function toneOf(fill, id) {
  if (fill === "#FFFFFF") return "white"
  if (fill === "#1B1B1F0A") return "neutral"
  fail(`${id} button fill is not white or neutral`)
}

function cellFrom(frameNode) {
  const kids = frameNode.children ?? []
  if (kids.length !== 1)
    fail(`cell ${frameNode.id} has ${kids.length} children`)
  const child = kids[0]
  if (child.type === "icon") {
    if (child.icon !== "check" || child.library !== "lucide") {
      fail(`cell ${frameNode.id} icon ${child.library}:${child.icon}`)
    }
    return { kind: "check" }
  }
  if (child.type === "text") {
    const value = trimmed(child)
    if (value === EN_DASH) return { kind: "dash" }
    if (value == null || value === "") fail(`cell ${frameNode.id} is empty`)
    if (BANNED_CELL_TEXT.has(value)) {
      fail(`cell ${frameNode.id} uses ${value}`)
    }
    return { kind: "text", value }
  }
  fail(`cell ${frameNode.id} type ${child.type}`)
}

function rowFrom(frameNode) {
  const kids = (frameNode.children ?? []).filter((child) => !isSpacer(child))
  const feature = kids.find((child) => child.type === "text")
  const cells = kids.filter((child) => child.type === "frame")
  const featureText = feature ? trimmed(feature) : ""
  if (!featureText || cells.length !== 2) fail(`row ${frameNode.id}`)
  const widths = cells.map((cell) => cell.width)
  return {
    feature: featureText,
    free: cellFrom(cells[0]),
    pro: cellFrom(cells[1]),
    valueWidth: sameNumber(`row ${frameNode.id} width`, widths),
  }
}

function directText(frameNode) {
  const texts = (frameNode.children ?? [])
    .map((child) => trimmed(child))
    .filter((value) => value)
  if (texts.length !== 1) fail(`${frameNode.id} text count ${texts.length}`)
  return texts[0]
}

function planFrom(card) {
  let name = null
  let kicker = null
  let audience = null
  let price = null
  let period = null
  let pricePx = null
  let priceTrackingPx = null
  let cta = null
  let tone = null
  let buttonPx = null
  let note = null
  let lead = null
  const features = []
  for (const child of card.children ?? []) {
    if (
      isSpacer(child) ||
      child.name === "Rule" ||
      child.type === "rectangle"
    ) {
      continue
    }
    if (child.name === "Top") {
      for (const part of child.children ?? []) {
        if (part.type === "text") name = trimmed(part)
        if (part.type === "frame") kicker = directText(part)
      }
      continue
    }
    if (child.type === "text" && audience == null) {
      audience = trimmed(child)
      continue
    }
    if (child.name === "Price") {
      const texts = (child.children ?? []).filter(
        (part) => part.type === "text"
      )
      if (texts.length !== 2) fail(`${card.id} price`)
      price = trimmed(texts[0])
      period = trimmed(texts[1])
      pricePx = texts[0].fontSize
      priceTrackingPx = texts[0].letterSpacing
      continue
    }
    if (child.name === "Button") {
      cta = directText(child)
      tone = toneOf(child.fill, child.id)
      buttonPx = child.height
      continue
    }
    if (child.name === "Helper") {
      note = directText(child)
      continue
    }
    if (child.name === "Features") {
      for (const part of child.children ?? []) {
        if (part.type === "text") {
          lead = trimmed(part)
          continue
        }
        if (part.type !== "frame") fail(`${card.id} feature ${part.id}`)
        const icon = (part.children ?? []).find((node) => node.type === "icon")
        const label = (part.children ?? [])
          .map((node) => trimmed(node))
          .find((value) => value)
        if (
          !icon ||
          icon.icon !== "check" ||
          icon.library !== "lucide" ||
          !label
        ) {
          fail(`${card.id} feature row ${part.id}`)
        }
        features.push(label)
      }
      continue
    }
    fail(`${card.name} unexpected ${child.name ?? child.type}`)
  }
  if (!name || !audience || !price || !period || !cta || !note) {
    fail(`${card.name} is incomplete`)
  }
  return {
    name,
    kicker,
    audience,
    price,
    period,
    pricePx,
    priceTrackingPx,
    cta,
    tone,
    buttonPx,
    note,
    lead,
    features,
    surface: surfaceOf(card.fill, card.id),
    shadow: card.effect?.type === "shadow",
    padPx: typeof card.padding === "number" ? card.padding : null,
    radiusPx: typeof card.cornerRadius === "number" ? card.cornerRadius : null,
  }
}

function includedItem(item) {
  const tile = (item.children ?? []).find((child) => child.name === "Tile")
  const icon = (tile?.children ?? []).find((child) => child.type === "icon")
  const texts = (item.children ?? [])
    .map((child) => trimmed(child))
    .filter((value) => value)
  if (
    !icon ||
    icon.library !== "lucide" ||
    typeof icon.icon !== "string" ||
    texts.length !== 2 ||
    tile.width !== 36
  ) {
    fail(`included item ${item.id}`)
  }
  return {
    icon: icon.icon,
    title: texts[0],
    body: texts[1],
    tilePx: tile.width,
    tileRadiusPx: tile.cornerRadius,
    iconPx: icon.width,
  }
}

function headerFrom(section) {
  const column = columnOf(section)
  const texts = (column.children ?? []).filter((child) => child.type === "text")
  if (texts.length !== 2 || column.layout !== "vertical") fail("header column")
  return {
    title: trimmed(texts[0]),
    titlePx: texts[0].fontSize,
    titleTrackingPx: texts[0].letterSpacing,
    titleLineHeight: texts[0].lineHeight,
    subhead: trimmed(texts[1]),
    subheadPx: texts[1].fontSize,
    subheadTrackingPx: texts[1].letterSpacing,
    gapPx: column.gap,
  }
}

function titleNode(column) {
  const node = (column.children ?? []).find((child) => child.type === "text")
  if (!node) fail(`${column.name} title`)
  return node
}

function compareFrom(section) {
  const column = columnOf(section)
  const kids = column.children ?? []
  let title = null
  let columns = null
  let headPx = null
  const blocks = []
  let current = null
  let seenHeader = false
  const groupPadTops = []
  const groupPadBottoms = []
  const valueWidths = []
  const rowHeights = []
  for (let index = 0; index < kids.length; index += 1) {
    const child = kids[index]
    if (isSpacer(child)) continue
    if (child.type === "text") {
      const value = trimmed(child)
      if (!seenHeader) {
        title = {
          text: value,
          fontPx: child.fontSize,
          trackingPx: child.letterSpacing,
        }
        continue
      }
      if (current) blocks.push(current)
      current = { label: value, rows: [] }
      const before = kids[index - 1]
      const after = kids[index + 1]
      if (!isSpacer(before) || !isSpacer(after)) {
        fail(`group ${value} spacing`)
      }
      groupPadTops.push(before.height)
      groupPadBottoms.push(after.height)
      continue
    }
    if (child.type === "frame" && child.height === 44) {
      seenHeader = true
      headPx = child.height
      const cells = (child.children ?? []).filter(
        (part) => part.type === "frame"
      )
      columns = cells.map((cell) => directText(cell))
      continue
    }
    if (child.type === "frame" && child.height === 48) {
      if (!current) current = { label: null, rows: [] }
      const row = rowFrom(child)
      valueWidths.push(row.valueWidth)
      rowHeights.push(child.height)
      current.rows.push({
        feature: row.feature,
        free: row.free,
        pro: row.pro,
      })
      continue
    }
    fail(`compare child ${child.id}`)
  }
  if (current) blocks.push(current)
  if (!title || !columns || columns.length !== 2) fail("compare header")
  return {
    title: title.text,
    titlePx: title.fontPx,
    titleTrackingPx: title.trackingPx,
    columns,
    blocks,
    headPx,
    rowPx: sameNumber("compare row", rowHeights),
    valuePx: sameNumber("compare value", valueWidths),
    groupPadTopPx: sameNumber("group pad top", groupPadTops),
    groupPadBottomPx: sameNumber("group pad bottom", groupPadBottoms),
  }
}

function pricingSnapshot(sourceFrame) {
  const children = sourceFrame.children ?? []
  const sections = children.map((child) => ({
    id: child.id,
    name: child.name,
    padTop: padTop(child),
  }))
  const byName = Object.fromEntries(
    children.map((child) => [child.name, child])
  )
  for (const name of [
    "Nav",
    "Header",
    "Plans",
    "Included",
    "Compare",
    "FAQ",
    "Prefooter",
    "Footer Wrap",
  ]) {
    if (!byName[name]) fail(`missing section ${name}`)
  }

  const header = headerFrom(byName.Header)
  const planColumn = columnOf(byName.Plans)
  const cards = (planColumn.children ?? []).filter(
    (child) => child.type === "frame"
  )
  if (cards.length !== 2) fail("expected two plans")
  const free = planFrom(cards[0])
  const pro = planFrom(cards[1])
  if (
    free.surface !== "paper" ||
    free.tone !== "neutral" ||
    free.kicker != null
  ) {
    fail("free plan chrome")
  }
  if (
    pro.surface !== "mesh" ||
    pro.tone !== "white" ||
    pro.kicker == null ||
    !pro.shadow
  ) {
    fail("pro plan chrome")
  }

  const includedColumn = columnOf(byName.Included)
  const includedTitle = titleNode(includedColumn)
  const itemRow = (includedColumn.children ?? []).find(
    (child) => child.type === "frame"
  )
  const includedItems = (itemRow?.children ?? []).map(includedItem)
  if (includedItems.length !== 4) fail("included count")

  const compare = compareFrom(byName.Compare)
  const faqColumn = columnOf(byName.FAQ)
  const faqTitle = titleNode(faqColumn)
  const faqItems = []
  const faqPads = []
  for (const child of faqColumn.children ?? []) {
    if (isSpacer(child) || child.type === "text") continue
    if (child.type !== "frame") fail(`faq ${child.id}`)
    const texts = (child.children ?? [])
      .map((part) => trimmed(part))
      .filter((value) => value)
    if (texts.length !== 2) fail(`faq item ${child.id}`)
    faqItems.push({ q: texts[0], a: texts[1] })
    faqPads.push(padTop(child))
  }

  const prefooterKids = byName.Prefooter.children ?? []
  const prefooterGap = prefooterKids.find((child) => isSpacer(child))
  const blockPads = ["Included", "Compare", "FAQ"].map((name) =>
    padTop(byName[name])
  )
  const columnWidths = [
    columnOf(byName.Header).width,
    planColumn.width,
    includedColumn.width,
    columnOf(byName.Compare).width,
    faqColumn.width,
  ]
  const sectionTitlePx = sameNumber("section title", [
    includedTitle.fontSize,
    compare.titlePx,
    faqTitle.fontSize,
  ])
  const sectionTrackingPx = sameNumber("section tracking", [
    includedTitle.letterSpacing,
    compare.titleTrackingPx,
    faqTitle.letterSpacing,
  ])

  return {
    source: { ...sourceOf(sourceFrame), width: sourceFrame.width },
    sections,
    metrics: {
      columnPx: sameNumber("column", columnWidths),
      titlePx: header.titlePx,
      titleTrackingPx: header.titleTrackingPx,
      titleLineHeight: header.titleLineHeight,
      headerGapPx: header.gapPx,
      subheadPx: header.subheadPx,
      subheadTrackingPx: header.subheadTrackingPx,
      padHeaderPx: padTop(byName.Header),
      padPlansPx: padTop(byName.Plans),
      padBlockPx: sameNumber("block pad", blockPads),
      padPrefooterPx: padTop(byName.Prefooter),
      padFooterPx: padTop(byName["Footer Wrap"]),
      prefooterGapPx: prefooterGap?.height ?? null,
      plansGapPx: planColumn.gap,
      cardPadPx: sameNumber("card pad", [free.padPx, pro.padPx]),
      cardRadiusPx: sameNumber("card radius", [free.radiusPx, pro.radiusPx]),
      buttonPx: sameNumber("button", [free.buttonPx, pro.buttonPx]),
      pricePx: sameNumber("price", [free.pricePx, pro.pricePx]),
      priceTrackingPx: sameNumber("price tracking", [
        free.priceTrackingPx,
        pro.priceTrackingPx,
      ]),
      sectionTitlePx,
      sectionTrackingPx,
      faqPadPx: sameNumber("faq pad", faqPads),
      compareHeadPx: compare.headPx,
      compareRowPx: compare.rowPx,
      compareValuePx: compare.valuePx,
      compareGroupPadTopPx: compare.groupPadTopPx,
      compareGroupPadBottomPx: compare.groupPadBottomPx,
      includedGapPx: includedColumn.gap,
      includedRowGapPx: itemRow.gap,
      tilePx: sameNumber(
        "tile",
        includedItems.map((item) => item.tilePx)
      ),
      tileRadiusPx: sameNumber(
        "tile radius",
        includedItems.map((item) => item.tileRadiusPx)
      ),
      includedIconPx: sameNumber(
        "included icon",
        includedItems.map((item) => item.iconPx)
      ),
    },
    header: { title: header.title, subhead: header.subhead },
    plans: {
      free: {
        name: free.name,
        audience: free.audience,
        price: free.price,
        period: free.period,
        cta: free.cta,
        note: free.note,
        tone: free.tone,
        surface: free.surface,
        features: free.features,
      },
      pro: {
        name: pro.name,
        kicker: pro.kicker,
        kickerOnNameRow: true,
        audience: pro.audience,
        price: pro.price,
        period: pro.period,
        cta: pro.cta,
        note: pro.note,
        tone: pro.tone,
        surface: pro.surface,
        lead: pro.lead,
        features: pro.features,
      },
    },
    included: {
      title: trimmed(includedTitle),
      items: includedItems.map((item) => ({
        icon: item.icon,
        title: item.title,
        body: item.body,
      })),
    },
    compare: {
      title: compare.title,
      columns: compare.columns,
      blocks: compare.blocks,
    },
    faq: {
      title: trimmed(faqTitle),
      items: faqItems,
    },
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
  snapshot = textSnapshot(frame)
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
  ? `// Generated from design/opencv.pen by scripts/pen-snapshot.mjs --pricing. Do not edit.\nexport const pricingSnapshot = ${json} as const\n`
  : json
writeFileSync(
  outFile,
  await prettier.format(body, {
    ...options,
    filepath: outFile,
  })
)

if (path.basename(outFile) === "landing.snapshot.json") {
  const styleSections = (
    Array.isArray(frame.children) ? frame.children : []
  ).map((child) => {
    const texts = []
    const marks = []
    collectStyleTexts(child, texts)
    collectMarks(child, marks)
    return {
      id: typeof child.id === "string" ? child.id : "",
      name: typeof child.name === "string" ? child.name : "",
      texts,
      marks,
    }
  })
  const stylesFile = path.join(path.dirname(outFile), "landing.styles.json")
  const stylesOptions = (await prettier.resolveConfig(stylesFile)) ?? options
  writeFileSync(
    stylesFile,
    await prettier.format(
      JSON.stringify({ source: sourceOf(requested), sections: styleSections }),
      { ...stylesOptions, filepath: stylesFile }
    )
  )
}
