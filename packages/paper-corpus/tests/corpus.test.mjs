import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const cvDirectory = new URL("fixtures/cvs/", import.meta.url)
const clipboardDirectory = new URL("fixtures/clipboard/", import.meta.url)
const cvIds = ["en", "vi"].flatMap((language) =>
  Array.from(
    { length: 10 },
    (_, index) => `${language}-${String(index + 1).padStart(2, "0")}`
  )
)
const textKinds = new Set([
  "title",
  "subtitle",
  "heading",
  "subheading",
  "paragraph",
])

function readExpected(id) {
  return JSON.parse(
    readFileSync(new URL(`${id}.expected.json`, cvDirectory), "utf8")
  )
}

function assertText(value) {
  assert.equal(typeof value, "string")
  assert.ok(value.trim().length > 0)
}

function assertBlock(block) {
  if (block.kind === "table") {
    assert.ok(Array.isArray(block.rows) && block.rows.length > 1)
    const columns = block.rows[0].length
    assert.ok(columns > 1)
    for (const row of block.rows) {
      assert.ok(Array.isArray(row))
      assert.equal(row.length, columns)
      row.forEach(assertText)
    }
    return
  }

  if (block.kind === "image") {
    assertText(block.alt)
    return
  }

  if (block.kind === "pageBreak") return

  assert.ok(textKinds.has(block.kind), `Unknown block kind ${block.kind}`)
  assertText(block.text)

  if ("list" in block) {
    const { kind, level } = block.list
    assert.equal(block.kind, "paragraph")
    assert.ok(kind === "bullet" || kind === "numbered")
    assert.ok(Number.isInteger(level) && level >= 0 && level <= 8)
  }

  if ("links" in block) {
    assert.ok(Array.isArray(block.links) && block.links.length > 0)
    for (const { text, href } of block.links) {
      assertText(text)
      assert.ok(block.text.includes(text))
      assert.match(href, /^https:\/\/example\.com\//)
    }
  }

  if ("rightTabStop" in block) {
    const { positionTwips } = block.rightTabStop
    assert.ok(Number.isInteger(positionTwips) && positionTwips > 0)
    assert.match(block.text, /^[^\t]+\t[^\t]+$/u)
  }
}

test("the corpus has ten Word and expected JSON pairs per language", () => {
  const filenames = cvIds.flatMap((id) => [`${id}.docx`, `${id}.expected.json`])
  assert.deepEqual(readdirSync(cvDirectory).sort(), filenames.sort())
})

for (const id of cvIds) {
  test(`${id} contains a Word document and matches the expected JSON schema`, () => {
    const file = fileURLToPath(new URL(`${id}.docx`, cvDirectory))
    const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
      encoding: "utf8",
    })
    assert.match(xml, /<w:document\s/u)
    assert.match(xml, /<w:body>/u)

    const expected = readExpected(id)
    assert.equal(expected.language, id.slice(0, 2))
    assert.deepEqual(expected.page, {
      widthMm: 210,
      heightMm: 297,
      marginMm: 20,
    })
    assert.ok(Array.isArray(expected.blocks))
    assert.equal(expected.blocks[0].kind, "title")
    assert.equal(expected.blocks[1].kind, "subtitle")
    expected.blocks.forEach(assertBlock)

    if (expected.language === "vi") {
      assert.match(xml, /[ăâđêôơưàáảãạ]/iu)
    }
  })
}

test("the corpus exercises each block kind and both nested list types", () => {
  const blocks = cvIds.flatMap((id) => readExpected(id).blocks)
  assert.deepEqual(
    new Set(blocks.map(({ kind }) => kind)),
    new Set([...textKinds, "image", "table", "pageBreak"])
  )
  for (const kind of ["bullet", "numbered"]) {
    assert.ok(
      blocks.some(({ list }) => list?.kind === kind && list.level === 0)
    )
    assert.ok(blocks.some(({ list }) => list?.kind === kind && list.level > 0))
  }
  assert.equal(blocks.filter(({ kind }) => kind === "image").length, 1)
  assert.ok(blocks.some(({ links }) => links))
  assert.ok(blocks.some(({ rightTabStop }) => rightTabStop))
})

test("the clipboard fixtures retain recognizable source markup", () => {
  const signatures = {
    "google-docs.html": /docs-internal-guid-/u,
    "web-job-listing.html": /<ol>/u,
    "web-project-readme.html": /<table>/u,
    "web-reference.html": /<ul>/u,
    "word.html": /mso-list:\s*l0 level2 lfo1/u,
  }
  assert.deepEqual(
    readdirSync(clipboardDirectory).sort(),
    Object.keys(signatures)
  )
  for (const [name, signature] of Object.entries(signatures)) {
    assert.match(
      readFileSync(new URL(name, clipboardDirectory), "utf8"),
      signature
    )
  }
})
