import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { DESIGN_MAP, isSameBox } from "./design-map.mjs"
import {
  boxSides,
  composedPlacement,
  framePath,
  findFrames,
  frameGeometry,
  indexPen,
  penPath,
} from "./pen.mjs"

const index = indexPen(
  JSON.parse(
    readFileSync(new URL("./fixtures/small.pen.json", import.meta.url), "utf8")
  )
)

test("a frame is found by id first, then by every node with that name", () => {
  assert.deepEqual(findFrames(index, "panel"), ["panel"])
  assert.deepEqual(findFrames(index, "Header"), ["header", "label"])
  assert.deepEqual(findFrames(index, "nothing"), [])
})

test("a frame's geometry reads size, radius, padding sides and gap", () => {
  const header = frameGeometry(index, "header")
  assert.equal(header.height, 48)
  assert.equal(header.width, "fill_container")
  assert.deepEqual(
    [
      header.paddingTop,
      header.paddingRight,
      header.paddingBottom,
      header.paddingLeft,
      header.gap,
    ],
    [0, 8, 0, 16, 6]
  )
  const body = frameGeometry(index, "body")
  assert.deepEqual(
    [body.paddingTop, body.paddingRight, body.paddingBottom, body.paddingLeft],
    [8, 18, 8, 18]
  )
})

test("an instance takes its master's size and its own placement", () => {
  const placed = frameGeometry(index, "placed")
  assert.deepEqual(
    [placed.width, placed.height, placed.radius, placed.x, placed.y],
    [400, 600, 12, 1020, 252]
  )
  assert.equal(placed.ref, "panel")
  assert.deepEqual(
    placed.children.map((child) => child.id),
    ["header", "body", "label"]
  )
})

test("padding shorthand expands like CSS", () => {
  assert.deepEqual(boxSides(undefined), [0, 0, 0, 0])
  assert.deepEqual(boxSides(4), [4, 4, 4, 4])
  assert.deepEqual(boxSides([1, 2, 3]), [1, 2, 3, 2])
})

test("the pen path comes from the flag, then OCV_PEN, then the default, else a fetch command", () => {
  const exists = (path) => path === "/b.pen" || path === "/c.pen"
  assert.equal(
    penPath({
      flag: "/a.pen",
      env: { OCV_PEN: "/b.pen" },
      fallback: "/c.pen",
      exists,
    }).path,
    "/b.pen"
  )
  assert.equal(penPath({ env: {}, fallback: "/c.pen", exists }).path, "/c.pen")
  const missing = penPath({ env: {}, fallback: "/d.pen", exists })
  assert.equal(missing.path, undefined)
  assert.match(
    missing.fetch,
    /git show origin\/chore\/350-design-kit-cli-skills:design\/opencv\.pen > \/d\.pen/
  )
})

const composed = indexPen(
  JSON.parse(
    readFileSync(
      new URL("./fixtures/composed.pen.json", import.meta.url),
      "utf8"
    )
  )
)
const SHELL = "OC App shell"

test("a frame inside the composed screen is placed there and its path starts at that screen", () => {
  assert.deepEqual(
    composedPlacement(composed, { frame: "coach", composedScreen: SHELL }),
    { inScreen: true, path: "OC App shell > Bottom bar > Coach button" }
  )
})

test("a master part counts only through an instance placed in the composed screen", () => {
  assert.deepEqual(
    composedPlacement(composed, {
      frame: "body",
      composedScreen: SHELL,
      via: "placed",
    }),
    { inScreen: true, path: "OC App shell > Chat panel (instance) > Body" }
  )
  assert.equal(
    composedPlacement(composed, { frame: "body", composedScreen: SHELL })
      .inScreen,
    false
  )
})

test("a kit specimen is not the composed screen and its full path is shown", () => {
  assert.deepEqual(
    composedPlacement(composed, { frame: "specimen", composedScreen: SHELL }),
    { inScreen: false, path: "Dock items > Dock button" }
  )
  assert.equal(
    framePath(composed, "placed"),
    "App kit > OC App shell > Chat panel (instance)"
  )
  assert.deepEqual(
    composedPlacement(composed, { frame: "gone", composedScreen: SHELL }),
    { inScreen: false, path: null }
  )
})

const REAL_PEN = join(homedir(), "tmp", "opencv-ui", "opencv.pen")

test(
  "every frame row in the design map sits in the composed app shell of the real pen file",
  { skip: !existsSync(REAL_PEN) && `no pen file at ${REAL_PEN}` },
  () => {
    const real = indexPen(JSON.parse(readFileSync(REAL_PEN, "utf8")))
    for (const row of DESIGN_MAP.filter((row) => !isSameBox(row))) {
      const placement = composedPlacement(real, row)
      assert.ok(placement.inScreen, `${row.label}: ${placement.path}`)
      assert.match(placement.path, /^OC App shell > /, row.label)
    }
  }
)
