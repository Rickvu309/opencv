import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const root = path.resolve(import.meta.dirname, "..")
const adrDir = path.join(root, "docs/adr")
const adrFiles = readdirSync(adrDir).filter((name) =>
  /^\d{4}-.+\.md$/.test(name)
)
const adrNumbers = new Set(adrFiles.map((name) => name.slice(0, 4)))

const TEXT_FILE = /\.(?:[cm]?[jt]sx?|css|md|json|ya?ml|sh)$/
const ADR_NUMBER = /\bADR[- ]?(\d{4})\b/g
const ADR_PATH = /docs\/adr\/(\d{4})(?:-[\w.-]*)?/g

function trackedTextFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => TEXT_FILE.test(file) && existsSync(path.join(root, file)))
}

function brokenCitations(file) {
  const broken = []
  const lines = readFileSync(path.join(root, file), "utf8").split("\n")
  lines.forEach((line, index) => {
    for (const [, number] of line.matchAll(ADR_NUMBER)) {
      if (!adrNumbers.has(number))
        broken.push(`${file}:${index + 1} cites ADR-${number}`)
    }
    for (const [cited, number] of line.matchAll(ADR_PATH)) {
      const named = cited.endsWith(".md")
        ? cited.slice("docs/adr/".length)
        : null
      if (!adrNumbers.has(number) || (named && !adrFiles.includes(named))) {
        broken.push(`${file}:${index + 1} cites ${cited}`)
      }
    }
  })
  return broken
}

test("every ADR a file cites exists in docs/adr", () => {
  const broken = trackedTextFiles().flatMap(brokenCitations)
  assert.deepEqual(
    broken,
    [],
    `These citations point at no file in docs/adr (the pre-release ADRs were deleted in #385, so old numbers point nowhere or at another decision). Retarget each to the decision that holds now (ls docs/adr) or drop the citation:\n${broken.join("\n")}`
  )
})
