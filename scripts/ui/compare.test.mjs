import assert from "node:assert/strict"
import test from "node:test"
import { compareRow, failed, renderTable } from "./compare.mjs"

const design = { width: 400, height: 600, radius: 12, x: 1020, gap: "$ds-gap" }

test("a difference within tolerance passes and one beyond it fails", () => {
  const rows = compareRow({
    label: "panel",
    design,
    rendered: { width: 400.6, height: 844, radius: 12, x: 1019 },
    props: ["width", "height", "radius", "x"],
    tolerance: 1,
  })
  assert.deepEqual(
    rows.map((row) => row.status),
    ["ok", "mismatch", "ok", "ok"]
  )
  assert.equal(rows[1].difference, 244)
  assert.equal(failed(rows).length, 1)
})

test("a zero tolerance fails any difference", () => {
  const [row] = compareRow({
    label: "p",
    design,
    rendered: { width: 400.5 },
    props: ["width"],
    tolerance: 0,
  })
  assert.equal(row.status, "mismatch")
})

test("an element missing from the page fails and a design value that is not a number is reported, not failed", () => {
  const rows = compareRow({
    label: "p",
    design,
    rendered: null,
    props: ["width", "gap"],
    tolerance: 1,
  })
  assert.deepEqual(
    rows.map((row) => row.status),
    ["missing", "no-design-number"]
  )
  assert.equal(failed(rows).length, 1)
})

test("the table aligns columns and shows a dash for no value", () => {
  const lines = renderTable(
    compareRow({
      label: "p",
      design,
      rendered: null,
      props: ["width"],
      tolerance: 1,
    })
  )
  assert.match(
    lines[0],
    /^element\s+property\s+design\s+rendered\s+difference\s+status$/
  )
  assert.match(lines[1], /^p\s+width\s+400\s+-\s+-\s+missing$/)
})
