import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-photo-screen-bounds.mjs"

test("photo bounds reject fixed height and unbounded outer geometry", () => {
  assert.equal(
    detect(
      `
    const figure = document.createElement("figure")
    figure.style.width = "180pt"
    figure.style.height = "240pt"
    Decoration.node(pos, end, {style: ` +
        "`display:block;width:${width}pt;float:right`" +
        `})
  `
    ).length,
    3
  )
  assert.deepEqual(
    detect(
      `
    const figure = document.createElement("figure")
    figure.style.width = "180pt"
    figure.style.maxWidth = "100%"
    figure.style.height = "auto"
    figure.style.aspectRatio = "3 / 4"
    Decoration.node(pos, end, {style: ` +
        "`display:block;max-width:100%;width:${width}pt;float:right`" +
        `})
  `
    ),
    []
  )
})

test("photo frames scale inside the bounded figure", () => {
  assert.equal(
    detect(`
    const frame = document.createElement("div")
    frame.style.position = "absolute"
    frame.style.width = "180pt"
    frame.style.height = "240pt"
    frame.style.left = "10pt"
    frame.style.top = "5pt"
  `).length,
    4
  )
  assert.deepEqual(
    detect(`
    const frame = document.createElement("div")
    frame.style.position = "absolute"
    frame.style.width = "80%"
    frame.style.height = "90%"
    frame.style.left = "10%"
    frame.style.top = "5%"
  `),
    []
  )
})

test("mounted photos and editor decorations keep screen geometry bounded", () => {
  for (const file of ["native-photo-render.ts", "native-layout-decorations.ts"])
    assert.deepEqual(
      detect(
        readFileSync(
          new URL(`../packages/paper-crdt/src/${file}`, import.meta.url),
          "utf8"
        )
      ),
      []
    )
})
