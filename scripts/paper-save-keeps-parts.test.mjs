import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const WRITES_MARKDOWN_ONLY =
  /toDocument:\s*\(?\s*\w+\s*\)?\s*=>\s*\(\s*\{\s*markdown\s*:/

function savesThatDropParts(files, read) {
  return files.filter((file) => WRITES_MARKDOWN_ONLY.test(read(file)))
}

const sources = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "apps/web/src/features/paper/*.ts",
    "apps/web/src/features/paper/*.tsx",
  ],
  { cwd: root, encoding: "utf8" }
)
  .split("\n")
  .filter((file) => file && !/\.test\.tsx?$/.test(file))
  .filter((file) => existsSync(path.join(root, file)))

test("an editor save keeps the parts of the document it loaded", () => {
  const dropping = savesThatDropParts(sources, (file) =>
    readFileSync(path.join(root, file), "utf8")
  )
  assert.deepEqual(
    dropping,
    [],
    `${dropping.join(", ")} saves a document built from the markdown alone. A save that sends only the markdown drops the sender, date and closing parts. Build the saved document from the loaded one, as compactLetterDocument does.`
  )
})

test("the detector flags a save that writes the markdown alone", () => {
  const files = {
    alone: "usePaperAutosave({ toDocument: (next) => ({ markdown: next }) })",
    whole:
      "usePaperAutosave({ toDocument: (next) => ({ ...loaded, markdown: next }) })",
    shaped: "usePaperAutosave({ toDocument: compactLetterDocument })",
  }
  assert.deepEqual(
    savesThatDropParts(Object.keys(files), (file) => files[file]),
    ["alone"]
  )
})
