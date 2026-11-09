import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const fonts = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../public/fonts"
)

function readManifest() {
  return JSON.parse(
    readFileSync(path.join(fonts, "manifest.json"), "utf8")
  ) as {
    name: string
    bytes: number
    sha256: string
    license: string
  }[]
}

it("matches every shipped font to its hash", () => {
  const entries = readManifest()
  expect(entries).toHaveLength(17)
  for (const entry of entries) {
    const bytes = readFileSync(path.join(fonts, entry.name))
    const hash = createHash("sha256").update(bytes).digest("hex")
    expect(hash, entry.name).toBe(entry.sha256)
    expect(bytes.length, entry.name).toBe(entry.bytes)
    expect(entry.license, entry.name).toBe("SIL OFL 1.1")
  }
})

it("names each shipped font in the face sheet and leaves the missing ones out", () => {
  const css = readFileSync(path.join(fonts, "faces.css"), "utf8")
  for (const entry of readManifest()) {
    expect(css, entry.name).toContain(`/fonts/${entry.name}`)
  }
  for (const name of [
    "Wingdings",
    "Symbol",
    "Segoe UI Emoji",
    "Noto Sans Symbols",
  ]) {
    expect(css, name).not.toContain(name)
  }
})

it("names each family in the license notice", () => {
  const text = readFileSync(path.join(fonts, "NOTICES.txt"), "utf8")
  for (const name of [
    "Carlito",
    "Caladea",
    "Jost",
    "Montserrat",
    "Open Sans",
    "Liberation",
  ]) {
    expect(text, name).toContain(name)
  }
})
