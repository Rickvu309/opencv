import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { lstatSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { bannedPunctuationLines } from "./lib/no-middle-dot-or-em-dash.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const lockfiles =
  /(?:^|\/)(?:[^/]+\.lockb?|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml)$/
const utf8 = new TextDecoder("utf-8", { fatal: true })

function textOf(file) {
  const path = join(root, file)
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) return null
  const bytes = readFileSync(path)
  if (bytes.includes(0)) return null
  try {
    return utf8.decode(bytes)
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file && !lockfiles.test(file))
}

test("tracked text keeps literal middle dots and em dashes out of OpenCV", () => {
  const hits = trackedFiles().flatMap((file) => {
    const source = textOf(file)
    if (source === null) return []
    return bannedPunctuationLines(source, file)
  })
  assert.deepEqual(hits, [], `Banned punctuation:\n${hits.join("\n")}`)
})

test("the detector reports the file and line for both characters, including CRLF", () => {
  assert.deepEqual(
    bannedPunctuationLines("Clean\r\nA \u00B7 B\r\nC \u2014 D", "copy.md"),
    ["copy.md:2", "copy.md:3"]
  )
})

test("ordinary punctuation and Unicode escapes for imported text stay quiet", () => {
  assert.deepEqual(
    bannedPunctuationLines(
      String.raw`Copy, labels, and text (including Vietnamese: Tiếng Việt).
Use a hyphen or recognize imported text with /[\u00B7\u2014]/u.`,
      "copy.md"
    ),
    []
  )
})
