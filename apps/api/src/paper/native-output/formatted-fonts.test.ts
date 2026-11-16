import { expect, it } from "vitest"
import { compileFormattedNativeDocx } from "./formatted.js"
import { letter, paragraph, presentation } from "./formatted.test-support.js"
import { attribute, elements, inspect } from "./inspect.test-support.js"

it("saved Liberation font ids export as their metric-compatible Word faces", async () => {
  const faces = [
    ["liberation-sans", "Arial"],
    ["liberation-serif", "Times New Roman"],
    ["liberation-mono", "Courier New"],
  ] as const
  for (const [fontId, name] of faces) {
    const document = letter(
      [{ ...paragraph("font"), content: [{ text: "Saved text", fontId }] }],
      { ...presentation(), inline: { fontId } }
    )
    const result = compileFormattedNativeDocx({ document })
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") throw new Error(result.reason)
    const archive = await inspect(result.value)
    for (const partName of ["word/document.xml", "word/styles.xml"]) {
      const part = archive.part(partName)
      const fonts = elements(part.root, "rFonts")
      expect(fonts.length, partName).toBeGreaterThan(0)
      for (const font of fonts)
        for (const encoding of ["ascii", "hAnsi", "eastAsia", "cs"])
          expect(attribute(font, encoding), `${fontId} ${encoding}`).toBe(name)
    }
  }
})
