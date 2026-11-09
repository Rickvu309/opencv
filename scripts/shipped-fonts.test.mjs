import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const fonts = join(
  dirname(fileURLToPath(import.meta.url)),
  "../apps/web/public/fonts"
)

function manifest() {
  return JSON.parse(readFileSync(join(fonts, "manifest.json"), "utf8"))
}

test("every shipped font matches its hash", () => {
  const entries = manifest()
  assert.equal(entries.length, 17)
  for (const entry of entries) {
    const bytes = readFileSync(join(fonts, entry.name))
    const hash = createHash("sha256").update(bytes).digest("hex")
    assert.equal(hash, entry.sha256, entry.name)
    assert.equal(bytes.length, entry.bytes, entry.name)
    assert.equal(entry.license, "SIL OFL 1.1", entry.name)
  }
})

test("the face sheet names each shipped font and leaves the missing ones out", () => {
  const css = readFileSync(join(fonts, "faces.css"), "utf8")
  for (const entry of manifest()) {
    assert.equal(css.includes(`/fonts/${entry.name}`), true, entry.name)
  }
  for (const name of [
    "Wingdings",
    "Symbol",
    "Segoe UI Emoji",
    "Noto Sans Symbols",
  ]) {
    assert.equal(css.includes(name), false, name)
  }
})

test("the license notice names each family", () => {
  const text = readFileSync(join(fonts, "NOTICES.txt"), "utf8")
  for (const name of [
    "Carlito",
    "Caladea",
    "Jost",
    "Montserrat",
    "Open Sans",
    "Liberation",
  ]) {
    assert.equal(text.includes(name), true, name)
  }
})
