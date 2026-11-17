import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { compileFormattedNativeDocx } from "./formatted.js"
import {
  cv,
  letter,
  owner,
  paragraph,
  presentation,
} from "./formatted.test-support.js"
import {
  attribute,
  elements,
  inspect,
  one,
  textOf,
} from "./inspect.test-support.js"
import { compileNativeLetterDocx, LETTER_PROFILE } from "./letter.js"

function compile(document: unknown) {
  const result = compileFormattedNativeDocx({ document })
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}

describe("formatted native Word output", () => {
  it("keeps named styles, flattened parent deletions, document defaults and direct off values", async () => {
    const archive = await inspect(
      compile(
        letter(
          [
            {
              ...paragraph("mixed"),
              paragraph: {
                paragraphStyle: "child-paragraph",
                after: 0,
                keepNext: false,
              },
              content: [
                {
                  text: "inherited",
                  characterStyle: "child",
                  bold: false,
                  italic: false,
                  underline: false,
                  strike: false,
                },
                { text: "default" },
              ],
            },
          ],
          {
            ...presentation(),
            inline: { characterStyle: "base", color: "#112233", bold: true },
            paragraph: { paragraphStyle: "base-paragraph", before: 120 },
            styles: [
              {
                id: "base",
                parent: null,
                kind: "character",
                values: {
                  bold: true,
                  italic: true,
                  strike: true,
                  color: "#AA0000",
                  fontId: "liberation-serif",
                  size: 280,
                },
              },
              {
                id: "child",
                parent: "base",
                kind: "character",
                values: { italic: null, underline: true, highlight: "#FFCC99" },
              },
              {
                id: "base-paragraph",
                parent: null,
                kind: "paragraph",
                values: { alignment: "center", after: 200, keepNext: true },
              },
              {
                id: "child-paragraph",
                parent: "base-paragraph",
                kind: "paragraph",
                values: { alignment: null },
              },
            ],
          }
        )
      )
    )
    const part = archive.part("word/document.xml")
    const runs = elements(part.root, "r")
    const direct = runs[0]
    const inherited = runs[1]
    if (!direct || !inherited) throw new Error("Missing runs")
    expect(attribute(one(direct, "rStyle"), "val")).toBe("Paper-child")
    for (const name of ["b", "bCs", "i", "iCs", "strike"])
      expect(attribute(one(direct, name), "val")).toBe("0")
    expect(attribute(one(direct, "u"), "val")).toBe("none")
    expect(elements(direct, "color")).toHaveLength(0)
    expect(attribute(one(inherited, "b"), "val")).toBe("1")
    const p = one(part.root, "p")
    expect(attribute(one(p, "pStyle"), "val")).toBe("Paper-child-paragraph")
    expect(attribute(one(p, "spacing"), "after")).toBe("0")
    expect(attribute(one(p, "keepNext"), "val")).toBe("0")
    const styles = archive.part("word/styles.xml")
    const child = elements(styles.root, "style").find(
      (node) => attribute(node, "styleId") === "Paper-child"
    )
    if (!child) throw new Error("Missing named style")
    expect(elements(child, "basedOn")).toHaveLength(0)
    expect(elements(child, "i")).toHaveLength(0)
    expect(attribute(one(child, "rFonts"), "ascii")).toBe("Times New Roman")
    expect(attribute(one(child, "shd"), "fill")).toBe("FFCC99")
    const defaults = one(styles.root, "docDefaults")
    expect(attribute(one(defaults, "color"), "val")).toBe("112233")
    expect(attribute(one(defaults, "spacing"), "before")).toBe("120")
  })

  it("writes every inline property, all font families, RGB highlight and exact text through links", async () => {
    const text = "  Việt e\u0302 😀 & < >\t\n  "
    const archive = await inspect(
      compile(
        letter([
          {
            ...paragraph("all"),
            content: [
              {
                text,
                bold: true,
                italic: true,
                underline: true,
                strike: true,
                color: "#1234AB",
                highlight: "#FEDCBA",
                fontId: "liberation-mono",
                size: 270,
                href: "https://example.org/?a=1&b=2",
              },
              { text: "Serif", fontId: "liberation-serif" },
              { text: "Sans", fontId: "liberation-sans" },
            ],
          },
        ])
      )
    )
    const part = archive.part("word/document.xml")
    const run = elements(part.root, "r")[0]
    if (!run) throw new Error("Missing run")
    expect(textOf(part, run)).toBe(text)
    expect(attribute(one(run, "sz"), "val")).toBe("27")
    expect(attribute(one(run, "szCs"), "val")).toBe("27")
    expect(attribute(one(run, "color"), "val")).toBe("1234AB")
    expect(attribute(one(run, "shd"), "fill")).toBe("FEDCBA")
    expect(attribute(one(run, "u"), "val")).toBe("single")
    for (const name of ["b", "bCs", "i", "iCs", "strike"])
      expect(attribute(one(run, name), "val")).toBe("1")
    expect(elements(run, "tab")).toHaveLength(1)
    expect(elements(run, "br")).toHaveLength(1)
    expect(
      elements(part.root, "rFonts").map((node) => attribute(node, "ascii"))
    ).toEqual(["Courier New", "Times New Roman", "Arial"])
    const rels = archive.part("word/_rels/document.xml.rels")
    const relation = elements(
      rels.root,
      "Relationship",
      "http://schemas.openxmlformats.org/package/2006/relationships"
    ).find((node) => attribute(node, "TargetMode", "") === "External")
    if (!relation) throw new Error("Missing link")
    expect(attribute(relation, "Target", "")).toBe(
      "https://example.org/?a=1&b=2"
    )
  })

  it("preserves all alignment, spacing and pagination properties without competing indent attributes", async () => {
    const archive = await inspect(
      compile(
        letter(
          [
            paragraph("first", "first", {
              paragraphStyle: "hanging",
              alignment: "justify",
              indent: { kind: "firstline", value: 360 },
              start: 480,
              end: 240,
              before: 0,
              after: 140,
              lineSpacing: { kind: "multiple", value: 1.5 },
              keepNext: false,
              keepTogether: false,
              widowOrphan: false,
            }),
            paragraph("hang", "hang", {
              paragraphStyle: "firstline",
              alignment: "right",
              indent: { kind: "hanging", value: 180 },
              lineSpacing: { kind: "exact", value: 420 },
              keepNext: true,
              keepTogether: true,
              widowOrphan: true,
            }),
            paragraph("minimum", "minimum", {
              alignment: "center",
              lineSpacing: { kind: "atleast", value: 300 },
            }),
            paragraph("zero", "zero", {
              alignment: "left",
              paragraphStyle: "hanging",
              indent: { kind: "firstline", value: 0 },
            }),
            paragraph("inherit", "inherit", { paragraphStyle: "hanging" }),
          ],
          {
            ...presentation(),
            styles: [
              {
                id: "hanging",
                parent: null,
                kind: "paragraph",
                values: { indent: { kind: "hanging", value: 240 } },
              },
              {
                id: "firstline",
                parent: null,
                kind: "paragraph",
                values: { indent: { kind: "firstline", value: 200 } },
              },
            ],
          }
        )
      )
    )
    const part = archive.part("word/document.xml")
    const rows = elements(part.root, "p")
    expect(
      rows
        .map((p) => elements(p, "jc")[0])
        .map((jc) => jc && attribute(jc, "val"))
    ).toEqual(["both", "right", "center", "left", undefined])
    const first = rows[0]
    const hanging = rows[1]
    if (!first || !hanging) throw new Error("Missing paragraph")
    expect(attribute(one(first, "spacing"), "line")).toBe("360")
    expect(attribute(one(first, "spacing"), "lineRule")).toBe("auto")
    expect(attribute(one(first, "spacing"), "before")).toBe("0")
    expect(attribute(one(first, "spacing"), "after")).toBe("140")
    expect(attribute(one(first, "ind"), "left")).toBe("480")
    expect(attribute(one(first, "ind"), "right")).toBe("240")
    expect(attribute(one(first, "ind"), "firstLine")).toBe("360")
    expect(attribute(one(first, "ind"), "hanging")).toBeUndefined()
    expect(attribute(one(hanging, "ind"), "firstLine")).toBeUndefined()
    expect(attribute(one(hanging, "ind"), "hanging")).toBe("180")
    expect(attribute(one(hanging, "ind"), "left")).toBe("180")
    expect(
      rows
        .map((p) => elements(p, "spacing")[0])
        .map((s) => s && attribute(s, "lineRule"))
    ).toEqual(["auto", "exact", "atLeast", undefined, undefined])
    for (const [index, expected] of [
      [0, "0"],
      [1, "1"],
    ] as const) {
      const p = rows[index]
      if (!p) throw new Error("Missing flags")
      for (const flag of ["keepNext", "keepLines", "widowControl"])
        expect(attribute(one(p, flag), "val")).toBe(expected)
    }
    for (const indent of elements(
      archive.part("word/styles.xml").root,
      "ind"
    )) {
      expect(attribute(indent, "firstLine")).toBeUndefined()
      expect(attribute(indent, "hanging")).toBeUndefined()
    }
    expect(rows.map((p) => attribute(one(p, "ind"), "firstLine"))).toEqual([
      "360",
      undefined,
      undefined,
      "0",
      undefined,
    ])
    expect(attribute(one(rows[4] ?? part.root, "ind"), "hanging")).toBe("240")
  })

  it("retains CV owners, fixed fields, an empty field, bodies and skill items in source order", async () => {
    const source = cv()
    const archive = await inspect(compile(source))
    const part = archive.part("word/document.xml")
    const expected = [source.header, ...source.blocks].flatMap((item) =>
      item.children.map((field) =>
        field.content.map((run) => run.text).join("")
      )
    )
    expect(elements(part.root, "p").map((p) => textOf(part, p))).toEqual(
      expected
    )
    expect(expected).toContain("")
    expect(expected).toContain("TypeScript & Vietnamese")
  })

  it("writes landscape page geometry, nested list counters, semantic headings and dividers", async () => {
    const list = (
      id: string,
      type: "bullet" | "numbered",
      children: unknown[] = [],
      values = {}
    ) => ({ id, type, content: [{ text: id }], paragraph: values, children })
    const page = {
      width: 16838,
      height: 11906,
      orientation: "landscape",
      top: 720,
      bottom: 900,
      start: 1000,
      end: 1100,
    }
    const archive = await inspect(
      compile(
        letter(
          [
            { ...paragraph("heading"), type: "heading", level: 2 },
            list("parent", "numbered", [
              list("child", "numbered", [list("deep", "bullet")]),
            ]),
            list("parent-two", "numbered", [], {
              start: 0,
              indent: { kind: "firstline", value: 0 },
            }),
            { id: "divider", type: "divider" },
            list("restart", "numbered"),
          ],
          { ...presentation(), page }
        )
      )
    )
    const part = archive.part("word/document.xml")
    expect(attribute(one(part.root, "pgSz"), "w")).toBe("16838")
    expect(attribute(one(part.root, "pgSz"), "h")).toBe("11906")
    expect(attribute(one(part.root, "pgSz"), "orient")).toBe("landscape")
    const margin = one(part.root, "pgMar")
    expect(
      ["top", "right", "bottom", "left"].map((name) => attribute(margin, name))
    ).toEqual(["720", "1100", "900", "1000"])
    expect(attribute(one(part.root, "outlineLvl"), "val")).toBe("1")
    expect(elements(part.root, "bottom")).toHaveLength(1)
    const lists = elements(part.root, "p").filter(
      (p) => elements(p, "numPr").length
    )
    expect(lists.map((p) => attribute(one(p, "ilvl"), "val"))).toEqual([
      "0",
      "1",
      "2",
      "0",
      "0",
    ])
    expect(lists.map((p) => attribute(one(p, "numId"), "val"))).toEqual([
      "1",
      "2",
      "3",
      "1",
      "4",
    ])
    expect(lists.map((p) => attribute(one(p, "ind"), "left"))).toEqual([
      "720",
      "1440",
      "2160",
      "0",
      "720",
    ])
    const numbering = archive.part("word/numbering.xml")
    expect(elements(numbering.root, "ind")).toHaveLength(0)
    expect(elements(numbering.root, "startOverride")).toHaveLength(4)
  })

  it.each([
    [2.05, 492],
    [4.15, 996],
    [1.125, 270],
  ])(
    "exports canonical decimal multiple %s as %s Word units",
    async (multiple, units) => {
      const archive = await inspect(
        compile(
          letter([
            paragraph("line", "line", {
              lineSpacing: { kind: "multiple", value: multiple! },
            }),
          ])
        )
      )
      const spacing = one(archive.part("word/document.xml").root, "spacing")
      expect(attribute(spacing, "line")).toBe(String(units))
      expect(attribute(spacing, "lineRule")).toBe("auto")
    }
  )

  it.each([
    ["unknown profile", { ...letter(), profile: "public" }],
    ["unknown structure", letter([{ id: "table", type: "table" }])],
    [
      "unknown layout",
      { ...letter(), presentation: { ...presentation(), columns: 2 } },
    ],
    [
      "fractional font unit",
      letter([
        { ...paragraph("size"), content: [{ text: "size", size: 221 }] },
      ]),
    ],
    [
      "fractional line unit",
      letter([
        paragraph("line", "line", {
          lineSpacing: { kind: "multiple", value: 1.001 },
        }),
      ]),
    ],
    [
      "unsafe link",
      letter([
        {
          ...paragraph("link"),
          content: [{ text: "link", href: "javascript:alert(1)" }],
        },
      ]),
    ],
    ["carriage return", letter([paragraph("cr", "bad\rtext")])],
    ["invalid Unicode", letter([paragraph("surrogate", "bad\uD800")])],
    ["invalid XML character", letter([paragraph("bad", "bad\uFFFE")])],
    [
      "missing style",
      letter([paragraph("style", "style", { paragraphStyle: "missing" })]),
    ],
    [
      "wrong field owner",
      {
        ...cv(),
        header: {
          ...owner("header", "contact"),
          children: owner("header", "wrong").children,
        },
      },
    ],
    [
      "photo media",
      {
        ...cv(),
        header: { ...owner("header", "contact"), photo: "paper-photo" },
      },
    ],
    [
      "reordered fixed fields",
      {
        ...cv(),
        header: {
          ...owner("header", "contact"),
          children: owner("header", "contact").children.reverse(),
        },
      },
    ],
  ])("refuses %s without returning an artifact", (_name, source) => {
    const result = compileFormattedNativeDocx({ document: source })
    expect(result.kind).toBe("refused")
    expect(result).not.toHaveProperty("value")
  })

  it("is deterministic, does not change its input, and preserves the old Letter package bytes", () => {
    const source = cv()
    const before = JSON.stringify(source)
    expect(compile(source)).toEqual(compile(source))
    expect(JSON.stringify(source)).toBe(before)
    const legacy = compileNativeLetterDocx({
      document: {
        version: 4,
        schemaRevision: 1,
        kind: "letter",
        clashes: [],
        blocks: [
          {
            id: "p",
            type: "paragraph",
            content: [
              {
                text: "  Việt e\u0302 😀 & < >\t\n",
                bold: true,
                italic: true,
                underline: true,
                href: "https://example.org/?a=1&b=2",
              },
            ],
          },
        ],
      },
      templateId: LETTER_PROFILE.templateId,
      profileId: LETTER_PROFILE.id,
    })
    expect(createHash("sha256").update(legacy).digest("hex")).toBe(
      "1aa6c2fd80aba0c2b9811cf2b6a2ed6e1d06a14fc838486a8a116c2bb60a17c7"
    )
  })
})
