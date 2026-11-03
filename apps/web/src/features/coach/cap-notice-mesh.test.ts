import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import styles from "./design/cap-notice.styles.json"

const css = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "design/cap-notice.pen.css"
  ),
  "utf8"
)

const MESH_FIRST_POINT = "#EAEFFA"
const MESH_POINT_COUNT = 9

describe("cap notice upgrade button", () => {
  it("draws the W3.6 uVUzR 3x3 mesh as nine radial layers, one per control point in row order", () => {
    const layers = [
      ...css.matchAll(/radial-gradient\(at [^,]+, (#[0-9a-f]+),/g),
    ]
    const start = styles.colors.indexOf(MESH_FIRST_POINT)
    const meshPoints = styles.colors
      .slice(start, start + MESH_POINT_COUNT)
      .map((color) => color.toLowerCase())
    expect(styles.source.upgradeButtonId).toBe("uVUzR")
    expect(layers.map((layer) => layer[1])).toEqual(meshPoints)
  })
})
