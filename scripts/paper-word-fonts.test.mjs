import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const apiRequire = createRequire(
  new URL("../apps/api/package.json", import.meta.url)
)
const { register } = apiRequire("tsx/esm/api")
register()

const { compileFormattedNativeDocx } =
  await import("../apps/api/src/paper/native-output/formatted.js")
const { letter, paragraph, presentation } =
  await import("../apps/api/src/paper/native-output/formatted.test-support.js")
const { attribute, elements, inspect } =
  await import("../apps/api/src/paper/native-output/inspect.test-support.js")

test("saved Liberation font ids export as their metric-compatible Word faces", async () => {
  const faces = [
    ["liberation-sans", "Arial"],
    ["liberation-serif", "Times New Roman"],
    ["liberation-mono", "Courier New"],
  ]
  for (const [fontId, name] of faces) {
    const document = letter(
      [{ ...paragraph("font"), content: [{ text: "Saved text", fontId }] }],
      { ...presentation(), inline: { fontId } }
    )
    const result = compileFormattedNativeDocx({ document })
    assert.equal(result.kind, "ok")
    const archive = await inspect(result.value)
    for (const partName of ["word/document.xml", "word/styles.xml"]) {
      const part = archive.part(partName)
      const fonts = elements(part.root, "rFonts")
      assert.ok(fonts.length > 0, partName)
      for (const font of fonts)
        for (const encoding of ["ascii", "hAnsi", "eastAsia", "cs"])
          assert.equal(attribute(font, encoding), name, `${fontId} ${encoding}`)
    }
  }
})
