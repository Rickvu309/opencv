import { describe, expect, it } from "vitest"

import { compileNativeLetterDocx, LETTER_PROFILE } from "./letter.js"
import {
  attribute,
  elements,
  inspect,
  one,
  textOf,
} from "./inspect.test-support.js"

const REL = "http://schemas.openxmlformats.org/package/2006/relationships"
const OFFICE_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"
const XML = "http://www.w3.org/XML/1998/namespace"

function paragraph(id: string, text: string) {
  return { id, type: "paragraph", content: text ? [{ text }] : [] }
}

function list(
  id: string,
  type: "bullet" | "numbered",
  children: unknown[] = []
) {
  return { id, type, content: [{ text: id }], children }
}

function letter(blocks: unknown[]) {
  return { version: 4, schemaRevision: 1, kind: "letter", blocks, clashes: [] }
}

function compile(document: unknown) {
  return compileNativeLetterDocx({
    document,
    templateId: LETTER_PROFILE.templateId,
    profileId: LETTER_PROFILE.id,
  })
}

describe("native Letter DOCX compiler", () => {
  it("retains all eight mark combinations inside and outside external hyperlinks", async () => {
    const runs = [false, true].flatMap((bold) =>
      [false, true].flatMap((italic) =>
        [false, true].flatMap((underline) =>
          [false, true].map((linked) => ({
            text: `B${bold}I${italic}U${underline}L${linked} & <Việt>`,
            ...(bold ? { bold: true } : {}),
            ...(italic ? { italic: true } : {}),
            ...(underline ? { underline: true } : {}),
            ...(linked ? { href: "https://example.org/a?q=Việt&x=1" } : {}),
          }))
        )
      )
    )
    const archive = await inspect(
      compile(letter([{ id: "mixed", type: "paragraph", content: runs }]))
    )
    const part = archive.part("word/document.xml")
    const actual = elements(part.root, "r")
    expect(actual).toHaveLength(runs.length)
    runs.forEach((expected, index) => {
      const run = actual[index]
      if (!run) throw new Error("Missing rich run")
      expect(textOf(part, run)).toBe(expected.text)
      expect(elements(run, "b")).toHaveLength(expected.bold ? 1 : 0)
      expect(elements(run, "i")).toHaveLength(expected.italic ? 1 : 0)
      expect(elements(run, "u")).toHaveLength(expected.underline ? 1 : 0)
      if (expected.underline)
        expect(attribute(one(run, "u"), "val")).toBe("single")
      expect(run.parent?.local === "hyperlink").toBe(Boolean(expected.href))
      if (expected.href && run.parent)
        expect(attribute(run.parent, "id", OFFICE_REL)).toBe("link1")
    })
    const rels = archive.part("word/_rels/document.xml.rels")
    const links = elements(rels.root, "Relationship", REL).filter(
      (node) => attribute(node, "TargetMode", "") === "External"
    )
    expect(links).toHaveLength(1)
    const link = links[0]
    if (!link) throw new Error("Missing hyperlink relation")
    expect(attribute(link, "Target", "")).toBe(
      "https://example.org/a?q=Việt&x=1"
    )
    expect(attribute(link, "Id", "")).toBe("link1")
  })

  it("round trips whitespace, empty paragraphs, XML entities and Unicode without normalization", async () => {
    const sentinel = "  English Tiếng Việt Việt 👩🏽‍💻 & < > \" ' \t tab\n\nend  "
    const blocks = [
      paragraph("first", sentinel),
      paragraph("empty", ""),
      paragraph("spaces", "   "),
    ]
    const archive = await inspect(compile(letter(blocks)))
    const part = archive.part("word/document.xml")
    const paragraphs = elements(part.root, "p")
    expect(paragraphs.map((node) => textOf(part, node))).toEqual([
      sentinel,
      "",
      "   ",
    ])
    expect(elements(part.root, "tab")).toHaveLength(1)
    expect(elements(part.root, "br")).toHaveLength(2)
    for (const node of elements(part.root, "t"))
      expect(attribute(node, "space", XML)).toBe("preserve")
  })

  it("keeps parent counters across children and restarts changed-kind and new child lists", async () => {
    const blocks = [
      list("parent1", "numbered", [
        list("child1", "numbered", [
          list("deep1", "bullet"),
          list("deep2", "bullet"),
        ]),
        list("child2", "numbered"),
        list("childBullet", "bullet"),
        list("childRestart", "numbered"),
      ]),
      list("parent2", "numbered", [list("newChild", "numbered")]),
      list("bullet", "bullet"),
      list("restart", "numbered"),
      paragraph("separator", "break"),
      list("afterBreak", "numbered"),
    ]
    const archive = await inspect(compile(letter(blocks)))
    const part = archive.part("word/document.xml")
    const numbering = archive.part("word/numbering.xml")
    const instances = elements(numbering.root, "num")
    const levels = elements(numbering.root, "abstractNum")
    const counters = new Map<string, number>()
    const rows = elements(part.root, "p").flatMap((node) => {
      const properties = elements(node, "numPr")[0]
      if (!properties) return []
      const id = attribute(one(properties, "numId"), "val")
      const depth = attribute(one(properties, "ilvl"), "val")
      const instance = instances.find((item) => attribute(item, "numId") === id)
      if (!id || !instance) throw new Error("Unresolved list instance")
      const abstractId = attribute(one(instance, "abstractNumId"), "val")
      const abstract = levels.find(
        (item) => attribute(item, "abstractNumId") === abstractId
      )
      const level =
        abstract &&
        elements(abstract, "lvl").find(
          (item) => attribute(item, "ilvl") === depth
        )
      if (!level) throw new Error("Unresolved list level")
      expect(attribute(one(instance, "lvlOverride"), "ilvl")).toBe(depth)
      expect(attribute(one(instance, "startOverride"), "val")).toBe("1")
      expect(attribute(one(level, "ind"), "left")).toBe(
        String((Number(depth) + 1) * 720)
      )
      expect(attribute(one(level, "ind"), "hanging")).toBe("360")
      expect(attribute(one(level, "lvlRestart"), "val")).toBe("0")
      const counter = (counters.get(id) ?? 0) + 1
      counters.set(id, counter)
      return [
        {
          text: textOf(part, node),
          id,
          depth: Number(depth),
          format: attribute(one(level, "numFmt"), "val"),
          counter,
        },
      ]
    })
    expect(
      rows.map(({ text, depth, format, counter }) => [
        text,
        depth,
        format,
        counter,
      ])
    ).toEqual([
      ["parent1", 0, "decimal", 1],
      ["child1", 1, "decimal", 1],
      ["deep1", 2, "bullet", 1],
      ["deep2", 2, "bullet", 2],
      ["child2", 1, "decimal", 2],
      ["childBullet", 1, "bullet", 1],
      ["childRestart", 1, "decimal", 1],
      ["parent2", 0, "decimal", 2],
      ["newChild", 1, "decimal", 1],
      ["bullet", 0, "bullet", 1],
      ["restart", 0, "decimal", 1],
      ["afterBreak", 0, "decimal", 1],
    ])
    expect(rows[0]?.id).toBe(rows[7]?.id)
    expect(rows[1]?.id).not.toBe(rows[8]?.id)
    expect(new Set(rows.map(({ id }) => id)).size).toBe(9)
  })

  it("packages explicit presentation, semantic headings and a real divider in original order", async () => {
    const archive = await inspect(
      compile(
        letter([
          paragraph("start", "first"),
          {
            id: "h2",
            type: "heading",
            level: 2,
            content: [{ text: "second" }],
          },
          { id: "rule", type: "divider" },
          { id: "h3", type: "heading", level: 3, content: [{ text: "third" }] },
          paragraph("end", "last"),
        ])
      )
    )
    expect(archive.names).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/numbering.xml",
      "docProps/custom.xml",
    ])
    const part = archive.part("word/document.xml")
    expect(elements(part.root, "p").map((node) => textOf(part, node))).toEqual([
      "first",
      "second",
      "",
      "third",
      "last",
    ])
    expect(
      elements(part.root, "pStyle").map((node) => attribute(node, "val"))
    ).toEqual(["Heading2", "Heading3"])
    expect(attribute(one(part.root, "bottom"), "val")).toBe("single")
    expect(attribute(one(part.root, "pgSz"), "w")).toBe("11906")
    expect(attribute(one(part.root, "pgSz"), "h")).toBe("16838")
    const styles = archive.part("word/styles.xml")
    expect(attribute(one(styles.root, "rFonts"), "ascii")).toBe("Noto Sans")
    expect(elements(styles.root, "keepNext")).toHaveLength(2)
    expect(
      elements(styles.root, "outlineLvl").map((node) => attribute(node, "val"))
    ).toEqual(["1", "2"])
    const defaults = one(styles.root, "docDefaults")
    expect(attribute(one(defaults, "spacing"), "line")).toBe("276")
    expect(attribute(one(defaults, "spacing"), "lineRule")).toBe("auto")
    expect(attribute(one(defaults, "sz"), "val")).toBe("22")
    expect(
      elements(styles.root, "sz").map((node) => attribute(node, "val"))
    ).toEqual(["22", "28", "24"])
    expect(attribute(one(part.root, "pgMar"), "left")).toBe("1134")
    const identity = archive.part("docProps/custom.xml")
    const properties = elements(
      identity.root,
      "property",
      "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
    )
    expect(properties.map((node) => attribute(node, "name", ""))).toEqual([
      "NativeLetterProfile",
      "NativeLetterTemplate",
      "NativeLetterExporter",
    ])
    expect(
      properties.map((node) => {
        const value = one(
          node,
          "lpwstr",
          "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
        )
        return identity.source.slice(value.openEnd, value.closeStart)
      })
    ).toEqual([
      LETTER_PROFILE.id,
      LETTER_PROFILE.templateId,
      LETTER_PROFILE.exporter,
    ])
    const contentTypes = archive.part("[Content_Types].xml")
    const overrides = elements(contentTypes.root, "Override", TYPES)
    expect(overrides.map((node) => attribute(node, "PartName", ""))).toEqual([
      "/word/document.xml",
      "/word/styles.xml",
      "/word/numbering.xml",
      "/docProps/custom.xml",
    ])
    const rootRels = archive.part("_rels/.rels")
    expect(
      elements(rootRels.root, "Relationship", REL).map((node) =>
        attribute(node, "Target", "")
      )
    ).toEqual(["word/document.xml", "docProps/custom.xml"])
  })

  it("keeps deterministic bytes and leaves a deeply frozen source untouched", () => {
    const source = letter([
      paragraph("a", "repeatable Việt"),
      list("b", "numbered"),
    ])
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === "object") {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
    }
    const before = JSON.stringify(source)
    freeze(source)
    expect(Buffer.from(compile(source))).toEqual(
      Buffer.from(compile(structuredClone(source)))
    )
    expect(JSON.stringify(source)).toBe(before)
  })

  it.each([
    "http://example.org/path",
    "https://example.org/?a=1&b=2",
    "mailto:person@example.org",
  ])("preserves safe hyperlink %s", async (href) => {
    const archive = await inspect(
      compile(
        letter([
          { id: "a", type: "paragraph", content: [{ text: "link", href }] },
        ])
      )
    )
    const rels = archive.part("word/_rels/document.xml.rels")
    expect(
      elements(rels.root, "Relationship", REL).map((node) =>
        attribute(node, "Target", "")
      )
    ).toContain(href)
  })

  it.each([
    ["version", { ...letter([]), version: 3 }],
    ["revision", { ...letter([]), schemaRevision: 2 }],
    ["unknown kind", { ...letter([]), kind: "proof" }],
    [
      "CV",
      {
        version: 4,
        schemaRevision: 1,
        kind: "cv",
        header: {
          id: "header",
          type: "header",
          name: "Name",
          email: "",
          phone: "",
          city: "",
          linkedin: "",
        },
        blocks: [],
        clashes: [],
      },
    ],
    ["document property", { ...letter([]), layout: "lost" }],
    ["unknown block", letter([{ id: "a", type: "table", rows: [] }])],
    [
      "unknown property",
      letter([{ ...paragraph("a", "safe"), align: "center" }]),
    ],
    [
      "unknown mark",
      letter([
        {
          id: "a",
          type: "paragraph",
          content: [{ text: "safe", strike: true }],
        },
      ]),
    ],
    [
      "false mark",
      letter([
        {
          id: "a",
          type: "paragraph",
          content: [{ text: "safe", bold: false }],
        },
      ]),
    ],
    [
      "plain-text fallback",
      letter([{ id: "a", type: "paragraph", content: "**lost**" }]),
    ],
    [
      "heading level",
      letter([{ id: "a", type: "heading", level: 1, content: [] }]),
    ],
    [
      "list depth",
      letter([
        list("a", "bullet", [
          list("b", "bullet", [list("c", "bullet", [list("d", "bullet")])]),
        ]),
      ]),
    ],
    ["duplicate ID", letter([paragraph("a", "one"), paragraph("a", "two")])],
    [
      "clash",
      {
        ...letter([paragraph("a", "safe")]),
        clashes: [
          {
            id: "clash",
            node: "a",
            offer: { kind: "remove" },
            offeredBy: "coach",
            at: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ],
  ])("refuses %s without returning bytes", (_, source) => {
    expect(() => compile(source)).toThrow()
  })

  it.each([
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///etc/passwd",
    "https://x.test/\nunsafe",
    " https://x.test",
    "https://x.test/\u0000",
  ])("refuses unsafe href %s", (href) => {
    expect(() =>
      compile(
        letter([
          { id: "a", type: "paragraph", content: [{ text: "link", href }] },
        ])
      )
    ).toThrow()
  })

  it.each([
    "\u0000",
    "\u0001",
    "\u000b",
    "\ufffe",
    "\uffff",
    "\ud800",
    "\udfff",
    "\r",
    "\r\n",
    "\u007f",
  ])("refuses invalid or normalizing text %j", (text) => {
    expect(() => compile(letter([paragraph("a", text)]))).toThrow()
  })

  it("refuses unsupported presentation identities", () => {
    for (const input of [
      { templateId: "simple", profileId: LETTER_PROFILE.id },
      {
        templateId: LETTER_PROFILE.templateId,
        profileId: "native-letter-a4-v2",
      },
    ])
      expect(() =>
        compileNativeLetterDocx({ document: letter([]), ...input })
      ).toThrow()
  })
})
