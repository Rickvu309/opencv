#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"

import { handTouchPairs } from "./lib/touch-targets.mjs"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
const ROOTS = ["apps/web/src", "packages/ui/src"]
const FILLED_VARIANTS = new Set(["primary", "destructive"])
const SIZES_IN_FILLED_COMPOUND = new Set(["default", "touch"])

function variantOf(opening) {
  const variant = opening.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.text === "variant"
  )
  if (!variant) return "default"
  return variant.initializer && ts.isStringLiteral(variant.initializer)
    ? variant.initializer.text
    : null
}

function keepsFilledLook(pair, opening) {
  const variant = variantOf(opening)
  if (variant !== null && !FILLED_VARIANTS.has(variant)) return true
  return (
    SIZES_IN_FILLED_COMPOUND.has(pair.size) ===
    SIZES_IN_FILLED_COMPOUND.has(pair.kitSize)
  )
}

function withoutPair(text, desktop) {
  return text
    .split(/\s+/)
    .filter((token) => token && token !== "h-11" && token !== desktop)
    .join(" ")
}

function editsFor(pair) {
  const { literal, classAttribute, sizeNode, kitSize, desktop } = pair
  const opening = classAttribute.parent.parent
  const rest = withoutPair(literal.text, desktop)
  const quote = literal.getText()[0]
  const edits = []
  const call = literal.parent
  if (rest) {
    edits.push({
      start: literal.getStart(),
      end: literal.getEnd(),
      text: `${quote}${rest}${quote}`,
    })
  } else if (
    classAttribute.initializer === literal ||
    (ts.isJsxExpression(classAttribute.initializer) &&
      classAttribute.initializer.expression === literal)
  ) {
    edits.push({
      start: classAttribute.getFullStart(),
      end: classAttribute.getEnd(),
      text: "",
    })
  } else if (ts.isCallExpression(call) && call.arguments.length === 2) {
    const other = call.arguments.find((argument) => argument !== literal)
    edits.push({
      start: call.getStart(),
      end: call.getEnd(),
      text: other.getText(),
    })
  } else if (ts.isCallExpression(call) && call.arguments.length > 2) {
    const index = call.arguments.indexOf(literal)
    const next = call.arguments[index + 1]
    edits.push(
      next
        ? { start: literal.getStart(), end: next.getStart(), text: "" }
        : {
            start: call.arguments[index - 1].getEnd(),
            end: literal.getEnd(),
            text: "",
          }
    )
  } else {
    edits.push({
      start: literal.getStart(),
      end: literal.getEnd(),
      text: `${quote}${quote}`,
    })
  }
  if (sizeNode)
    edits.push({
      start: sizeNode.getStart(),
      end: sizeNode.getEnd(),
      text: `size="${kitSize}"`,
    })
  else
    edits.push({
      start: opening.tagName.getEnd(),
      end: opening.tagName.getEnd(),
      text: ` size="${kitSize}"`,
    })
  return edits
}

export function migrateTouchButtons(source, fileName = "file.tsx") {
  const moved = []
  const left = []
  const edits = []
  for (const pair of handTouchPairs(source, fileName)) {
    const opening = pair.classAttribute.parent.parent
    if (pair.movable && keepsFilledLook(pair, opening)) {
      moved.push(pair)
      edits.push(...editsFor(pair))
    } else left.push(pair)
  }
  const output = edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, edit) =>
        text.slice(0, edit.start) + edit.text + text.slice(edit.end),
      source
    )
  return {
    source: output,
    moved: moved.map(({ line, kitSize }) => ({ line, kitSize })),
    left: left.map(({ line, desktop, size }) => ({ line, desktop, size })),
  }
}

function trackedTsx() {
  return execFileSync("git", ["ls-files", ...ROOTS], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
}

function main(argv) {
  const write = argv.includes("--write")
  const changed = []
  const left = []
  let moved = 0
  for (const file of trackedTsx()) {
    const full = path.join(repoRoot, file)
    const before = readFileSync(full, "utf8")
    const result = migrateTouchButtons(before, file)
    moved += result.moved.length
    for (const item of result.left)
      left.push(
        `${file}:${item.line} h-11 ${item.desktop} with size ${item.size ?? "(dynamic)"}`
      )
    if (result.source !== before) {
      changed.push(file)
      if (write) writeFileSync(full, result.source)
    }
  }
  console.log(
    `${write ? "moved" : "would move"} ${moved} Button(s) in ${changed.length} file(s)`
  )
  for (const file of changed) console.log(`  ${file}`)
  if (left.length > 0) {
    console.log(`left by hand: ${left.length}`)
    for (const line of left) console.log(`  ${line}`)
  }
  if (write && changed.length > 0)
    execFileSync("pnpm", ["exec", "prettier", "--write", ...changed], {
      cwd: repoRoot,
      stdio: "ignore",
    })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2))
