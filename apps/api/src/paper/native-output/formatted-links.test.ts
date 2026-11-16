import { describe, expect, it } from "vitest"
import { compileFlowNativeDocx } from "./formatted.js"
import { cv, paragraph, presentation } from "./formatted.test-support.js"
import {
  attribute,
  elements,
  inspect,
  one,
  textOf,
} from "./inspect.test-support.js"

function compileRich(
  kind: string,
  blocks: unknown[],
  appearance: unknown = presentation()
) {
  const result = compileFlowNativeDocx({
    generation: "rich",
    document: {
      profile: "private-layout-3",
      kind,
      presentation: appearance,
      flow: {
        id: "flow",
        type: "flow",
        children: [
          {
            id: "section",
            type: "flowSection",
            start: "continuous",
            page: presentation().page,
            columns: { count: 1, gap: 360 },
            children: [...(kind === "cv" ? [cv().header] : []), ...blocks],
          },
        ],
      },
    },
  })
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}

describe("formatted native Word output", () => {
  it.each(["cv", "letter"])(
    "preserves all sixteen direct mark combinations on %s links",
    async (kind) => {
      const runs = [false, true].flatMap((bold) =>
        [false, true].flatMap((italic) =>
          [false, true].flatMap((underline) =>
            [false, true].flatMap((strike) =>
              [false, true].map((linked) => ({
                text: `${bold}-${italic}-${underline}-${strike}-${linked}`,
                bold,
                italic,
                underline,
                strike,
                ...(linked ? { href: "https://example.org/marks" } : {}),
              }))
            )
          )
        )
      )
      const block = { ...paragraph("marks"), content: runs }
      const archive = await inspect(compileRich(kind, [block]))
      const part = archive.part("word/document.xml")
      for (const expected of runs) {
        const run = elements(part.root, "r").find(
          (node) => textOf(part, node) === expected.text
        )
        if (!run) throw new Error(`Missing mark combination ${expected.text}`)
        for (const [key, tag] of [
          ["bold", "b"],
          ["italic", "i"],
          ["strike", "strike"],
        ] as const) {
          if (expected[key]) expect(attribute(one(run, tag), "val")).toBe("1")
          else
            for (const mark of elements(run, tag))
              expect(attribute(mark, "val")).toBe("0")
        }
        expect(attribute(one(run, "u"), "val")).toBe(
          expected.underline ? "single" : "none"
        )
        expect(run.parent?.local === "hyperlink").toBe(Boolean(expected.href))
        if (expected.href)
          expect(attribute(one(run, "rStyle"), "val")).toBe("Hyperlink")
      }
      const style = elements(
        archive.part("word/styles.xml").root,
        "style"
      ).find((node) => attribute(node, "styleId") === "Hyperlink")
      if (!style) throw new Error("Missing default link style")
      expect(attribute(one(style, "color"), "val")).toBe("1D4ED8")
      expect(attribute(one(style, "u"), "val")).toBe("single")
    }
  )

  it.each(["cv", "letter"])(
    "keeps named character styles and explicit link colors in a rich %s",
    async (kind) => {
      const appearance = {
        ...presentation(),
        styles: [
          {
            id: "contact",
            kind: "character",
            parent: null,
            values: {
              fontId: "liberation-serif",
              size: 360,
              highlight: "#FFFF00",
              color: "#009900",
              underline: false,
            },
          },
        ],
      }
      const runs = [
        {
          text: "Named default",
          characterStyle: "contact",
          href: "https://example.org/default",
        },
        {
          text: "Named explicit",
          characterStyle: "contact",
          href: "https://example.org/explicit",
          color: "#1234AB",
          underline: false,
        },
        { text: "Plain default", href: "https://example.org/plain" },
        {
          text: "Plain explicit",
          href: "https://example.org/color",
          color: "#123456",
          underline: false,
        },
      ]
      const archive = await inspect(
        compileRich(
          kind,
          [{ ...paragraph("links"), content: runs }],
          appearance
        )
      )
      const part = archive.part("word/document.xml")
      const styles = elements(archive.part("word/styles.xml").root, "style")
      const named = styles.find(
        (node) => attribute(node, "styleId") === "Paper-contact"
      )
      if (!named) throw new Error("Missing named character style")
      expect(attribute(one(named, "rFonts"), "ascii")).toBe("Liberation Serif")
      expect(attribute(one(named, "sz"), "val")).toBe("36")
      expect(attribute(one(named, "shd"), "fill")).toBe("FFFF00")
      const hyperlink = styles.find(
        (node) => attribute(node, "styleId") === "Hyperlink"
      )
      if (!hyperlink) throw new Error("Missing Hyperlink style")
      for (const expected of runs) {
        const run = elements(part.root, "r").find(
          (node) => textOf(part, node) === expected.text
        )
        if (!run) throw new Error(`Missing ${expected.text}`)
        expect(attribute(one(run, "rStyle"), "val")).toBe(
          expected.characterStyle ? "Paper-contact" : "Hyperlink"
        )
        expect(
          attribute(
            one(
              expected.characterStyle || expected.color ? run : hyperlink,
              "color"
            ),
            "val"
          )
        ).toBe(expected.color?.slice(1) ?? "1D4ED8")
        expect(
          attribute(
            one(
              expected.characterStyle || expected.underline !== undefined
                ? run
                : hyperlink,
              "u"
            ),
            "val"
          )
        ).toBe(expected.underline === false ? "none" : "single")
        expect(run.parent?.local).toBe("hyperlink")
      }
    }
  )
})
