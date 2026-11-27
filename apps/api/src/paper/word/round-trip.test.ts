import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { documentSchema, type Document } from "@workspace/domain/paper-doc"
import mammoth from "mammoth"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  descendants,
  isWord,
  parsePackageXml,
  wordAttribute,
  wordChild,
  type XmlElement,
} from "../import/package-xml.js"
import { readPackageZip } from "../import/package-zip.js"
import { writeDocx, type WordFiles } from "./write-docx.js"

const directory = new URL(
  "../../../../../packages/paper-corpus/tests/fixtures/cvs/",
  import.meta.url
)
const photoId = "00000000-0000-4000-8000-000000000001"
const cvIds = (await readdir(directory))
  .filter((path) => path.endsWith(".expected.json"))
  .sort()
  .map((path) => path.replace(".expected.json", ""))

const corpusText = z.object({
  kind: z.enum(["title", "subtitle", "heading", "subheading", "paragraph"]),
  text: z.string(),
  list: z
    .object({ kind: z.enum(["bullet", "numbered"]), level: z.number() })
    .optional(),
  links: z.array(z.object({ text: z.string(), href: z.string() })).optional(),
  rightTabStop: z.object({ positionTwips: z.number() }).optional(),
})

const corpus = z.object({
  page: z.object({
    widthMm: z.number(),
    heightMm: z.number(),
    marginMm: z.number(),
  }),
  blocks: z.array(
    z.union([
      corpusText,
      z.object({
        kind: z.literal("table"),
        rows: z.array(z.array(z.string())),
      }),
      z.object({ kind: z.literal("image"), alt: z.string() }),
      z.object({ kind: z.literal("pageBreak") }),
    ])
  ),
})

function runs(
  text: string,
  links: NonNullable<z.infer<typeof corpusText>["links"]> = []
) {
  const content: unknown[] = []
  let rest = text
  for (const link of links) {
    const at = rest.indexOf(link.text)
    expect(at).toBeGreaterThanOrEqual(0)
    if (at > 0) content.push({ type: "text", text: rest.slice(0, at) })
    content.push({
      type: "text",
      text: link.text,
      marks: [{ type: "link", attrs: { href: link.href } }],
    })
    rest = rest.slice(at + link.text.length)
  }
  if (rest) content.push({ type: "text", text: rest })
  return content
}

const mmToMpt = (mm: number) => Math.round((mm * 72000) / 25.4)
const mmToTwips = (mm: number) => String(Math.round((mm * 1440) / 25.4))

async function loadCv(id: string) {
  const expected = corpus.parse(
    JSON.parse(
      await readFile(new URL(`${id}.expected.json`, directory), "utf8")
    )
  )
  const margin = mmToMpt(expected.page.marginMm)
  const width = mmToMpt(expected.page.widthMm) - 2 * margin
  const content = expected.blocks.map((block, index) => {
    const id = `block-${index}`
    switch (block.kind) {
      case "image":
        return {
          type: "image",
          attrs: {
            id,
            fileId: photoId,
            widthMpt: 96000,
            heightMpt: 96000,
            align: "left",
            alt: block.alt,
          },
        }
      case "pageBreak":
        return { type: "page_break", attrs: { id } }
      case "table": {
        const columns = block.rows[0]?.length ?? 1
        return {
          type: "table",
          attrs: {
            id,
            columnsMpt: Array.from({ length: columns }, () =>
              Math.round(width / columns)
            ),
            borders: "all",
          },
          content: block.rows.map((row) => ({
            type: "table_row",
            content: row.map((text) => ({
              type: "table_cell",
              content: runs(text),
            })),
          })),
        }
      }
      default:
        return {
          type: "text_block",
          attrs: {
            id,
            kind: block.kind,
            list: block.list?.kind ?? null,
            level: block.list?.level ?? 0,
            align: "left",
            lineSpacing: null,
            keepWithNext: null,
            ...(block.rightTabStop
              ? { rightTabMpt: block.rightTabStop.positionTwips * 50 }
              : {}),
          },
          content: runs(block.text, block.links),
        }
    }
  })
  const doc = documentSchema.parse({
    type: "doc",
    attrs: {
      schema: 1,
      template: "classic",
      page: {
        size: "A4",
        orientation: "portrait",
        marginsMpt: {
          top: margin,
          right: margin,
          bottom: margin,
          left: margin,
        },
      },
    },
    content,
  })
  const photo = doc.content.find((block) => block.type === "image")
  const files: WordFiles = new Map()
  if (photo) {
    const original = await readPackageZip(
      await readFile(new URL(`${id}.docx`, directory))
    )
    const bytes = original.files.get("word/media/image1.png")
    if (!bytes) throw new Error(`Missing corpus photo in ${id}`)
    return {
      doc,
      expected,
      files: new Map([
        [photo.attrs.fileId, { bytes, mediaType: "image/png" }],
      ]) satisfies WordFiles,
    }
  }
  return { doc, expected, files }
}

function wordNodes(root: XmlElement, name: string) {
  return descendants(root).filter((node) => isWord(node, name))
}

function childVal(node: XmlElement, name: string, attribute = "val") {
  const child = wordChild(node, name)
  return child && wordAttribute(child, attribute)
}

function attribute(node: XmlElement, name: string) {
  return node.attributes.find((attr) => attr.local === name)?.value
}

function part(files: Map<string, Buffer>, name: string) {
  const bytes = files.get(name)
  if (!bytes) throw new Error(`Missing Word part ${name}`)
  return parsePackageXml(bytes).root
}

const styles = {
  title: "Title",
  subtitle: "Subtitle",
  heading: "Heading1",
  subheading: "Heading2",
  paragraph: "Normal",
}

describe("Word export of the Paper corpus", () => {
  it("has all 20 CVs", () => expect(cvIds).toHaveLength(20))

  it.each(cvIds)("%s retains editable Word structure", async (id) => {
    const { doc, expected, files } = await loadCv(id)
    const archive = await readPackageZip(writeDocx(doc, files))
    const document = part(archive.files, "word/document.xml")
    const styleSheet = part(archive.files, "word/styles.xml")
    const numbering = part(archive.files, "word/numbering.xml")
    const relationships = part(
      archive.files,
      "word/_rels/document.xml.rels"
    ).children
    const definitions = new Map(
      wordNodes(numbering, "abstractNum").map((node) => [
        wordAttribute(node, "abstractNumId"),
        node,
      ])
    )
    const lists = new Map(
      wordNodes(numbering, "num").map((node) => [
        wordAttribute(node, "numId"),
        definitions.get(childVal(node, "abstractNumId")),
      ])
    )

    expect(
      wordNodes(styleSheet, "style")
        .filter((node) => wordAttribute(node, "type") === "paragraph")
        .map((node) => wordAttribute(node, "styleId"))
        .sort()
    ).toEqual([...Object.values(styles), "ListParagraph"].sort())
    expect(
      [...definitions.values()].map((node) =>
        wordNodes(node, "lvl").map((level) => wordAttribute(level, "ilvl"))
      )
    ).toEqual(
      Array.from({ length: 2 }, () =>
        Array.from({ length: 9 }, (_, level) => String(level))
      )
    )

    const paragraphs = wordChild(document, "body")?.children.filter(
      (node) =>
        isWord(node, "p") && wordChild(wordChild(node, "pPr") ?? node, "pStyle")
    )
    const textBlocks = expected.blocks.filter((block) => block.kind in styles)
    expect(
      paragraphs?.map((node) =>
        childVal(wordChild(node, "pPr") ?? node, "pStyle")
      )
    ).toEqual(
      textBlocks.map((block) => {
        const text = corpusText.parse(block)
        return text.list ? "ListParagraph" : styles[text.kind]
      })
    )
    expect(
      wordNodes(document, "numPr").map((node) => {
        const level = childVal(node, "ilvl")
        const definition = lists.get(childVal(node, "numId"))
        const properties = definition?.children.find(
          (child) => wordAttribute(child, "ilvl") === level
        )
        return {
          level: Number(level),
          format: properties && childVal(properties, "numFmt"),
        }
      })
    ).toEqual(
      textBlocks.flatMap((block) => {
        const { list } = corpusText.parse(block)
        if (!list) return []
        const formats = ["decimal", "lowerLetter", "lowerRoman"]
        return [
          {
            level: list.level,
            format: list.kind === "bullet" ? "bullet" : formats[list.level % 3],
          },
        ]
      })
    )
    expect(
      wordNodes(document, "hyperlink").map((node) => {
        const relationship = relationships.find(
          (rel) => attribute(rel, "Id") === attribute(node, "id")
        )
        expect(relationship && attribute(relationship, "TargetMode")).toBe(
          "External"
        )
        return relationship && attribute(relationship, "Target")
      })
    ).toEqual(
      textBlocks.flatMap(
        (block) => corpusText.parse(block).links?.map(({ href }) => href) ?? []
      )
    )
    expect(wordNodes(document, "drawing")).toHaveLength(
      expected.blocks.filter((block) => block.kind === "image").length
    )
    expect(
      [...archive.files.keys()].filter((path) => path.startsWith("word/media/"))
    ).toHaveLength(files.size)
    expect(wordNodes(document, "tbl")).toHaveLength(
      expected.blocks.filter((block) => block.kind === "table").length
    )
    expect(
      wordNodes(document, "br").filter(
        (node) => wordAttribute(node, "type") === "page"
      )
    ).toHaveLength(
      expected.blocks.filter((block) => block.kind === "pageBreak").length
    )
    expect(
      wordNodes(document, "tab")
        .filter((node) => wordAttribute(node, "val") === "right")
        .map((node) => wordAttribute(node, "pos"))
    ).toEqual(
      textBlocks.flatMap((block) => {
        const { rightTabStop } = corpusText.parse(block)
        return rightTabStop ? [String(rightTabStop.positionTwips)] : []
      })
    )
    const pageSize = wordNodes(document, "pgSz")[0]
    expect([
      wordAttribute(pageSize, "w"),
      wordAttribute(pageSize, "h"),
    ]).toEqual([
      mmToTwips(expected.page.widthMm),
      mmToTwips(expected.page.heightMm),
    ])
    const margin = wordNodes(document, "pgMar")[0]
    expect(
      ["top", "right", "bottom", "left"].map((side) =>
        wordAttribute(margin, side)
      )
    ).toEqual(Array(4).fill(mmToTwips(expected.page.marginMm)))
  })

  it.each(["en-01", "vi-03"])(
    "%s opens in Mammoth with headings, lists and links",
    async (id) => {
      const { doc, files } = await loadCv(id)
      const buffer = writeDocx(doc, files)
      const { value, messages } = await mammoth.convertToHtml(
        { buffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1.title:fresh",
            "p[style-name='Subtitle'] => p.subtitle:fresh",
          ],
        }
      )
      expect(messages).toEqual([])
      const headings = [
        ...value.matchAll(/<h[12](?: class="title")?>(.*?)<\/h[12]>/gu),
      ].map((match) => match[1])
      const lists = [...value.matchAll(/<(ul|ol)>/gu)].map((match) => match[1])
      const links = [...value.matchAll(/<a href="([^"]+)"/gu)].map(
        (match) => match[1]
      )
      expect(headings.length).toBeGreaterThan(2)
      expect(lists.length).toBeGreaterThan(0)
      expect(links.length).toBeGreaterThan(0)
      if (process.env.OPENCV_WORD_PROOF_DIR) {
        await mkdir(process.env.OPENCV_WORD_PROOF_DIR, { recursive: true })
        await writeFile(
          join(process.env.OPENCV_WORD_PROOF_DIR, `${id}.docx`),
          buffer
        )
        process.stdout.write(
          `${JSON.stringify({ id, headings, lists, links })}\n`
        )
      }
    }
  )
})

it("writes marks, links with escaped attributes, text breaks and a right tab", async () => {
  const { doc } = await loadCv("en-02")
  const input: Document = documentSchema.parse({
    ...doc,
    attrs: {
      ...doc.attrs,
      page: {
        size: "A4",
        orientation: "landscape",
        marginsMpt: { top: 12000, right: 24000, bottom: 36000, left: 48000 },
      },
    },
    content: [
      {
        type: "text_block",
        attrs: {
          id: "marked",
          kind: "paragraph",
          list: null,
          level: 0,
          align: "justify",
          lineSpacing: 1.5,
          keepWithNext: false,
          rightTabMpt: 123450,
        },
        content: [
          {
            type: "text",
            text: " A&B\t<item> ",
            marks: [
              { type: "bold" },
              { type: "italic" },
              { type: "underline" },
              { type: "strike" },
              { type: "link", attrs: { href: "https://example.org/?a=1&b=2" } },
              { type: "color", attrs: { value: "#ab0123" } },
              { type: "font", attrs: { family: "Liberation Mono" } },
              { type: "size", attrs: { mpt: 12500 } },
            ],
          },
          { type: "hard_break" },
          {
            type: "text",
            text: "Serif",
            marks: [{ type: "font", attrs: { family: "Liberation Serif" } }],
          },
          {
            type: "text",
            text: "Carlito",
            marks: [{ type: "font", attrs: { family: "Carlito" } }],
          },
        ],
      },
    ],
  })
  const archive = await readPackageZip(writeDocx(input, new Map()))
  const document = part(archive.files, "word/document.xml")
  const properties = wordNodes(document, "rPr")[0]
  expect(properties.children.map((node) => node.local)).toEqual(
    expect.arrayContaining(["b", "i", "strike", "u", "color", "sz"])
  )
  expect(childVal(properties, "color")).toBe("AB0123")
  expect(childVal(properties, "sz")).toBe("25")
  expect(
    wordNodes(document, "rFonts").map((node) => wordAttribute(node, "ascii"))
  ).toEqual(["Courier New", "Times New Roman", "Calibri"])
  expect(wordNodes(document, "br")).toHaveLength(1)
  expect(wordNodes(document, "tab")).toHaveLength(2)
  expect(archive.files.get("word/document.xml")?.toString()).toContain(
    ' A&amp;B</w:t><w:tab/><w:t xml:space="preserve">&lt;item&gt; '
  )
  const relationships = part(
    archive.files,
    "word/_rels/document.xml.rels"
  ).children
  expect(relationships.map((node) => attribute(node, "Target"))).toContain(
    "https://example.org/?a=1&b=2"
  )
  const page = wordNodes(document, "pgSz")[0]
  expect(["w", "h", "orient"].map((name) => wordAttribute(page, name))).toEqual(
    ["16838", "11906", "landscape"]
  )
  const margin = wordNodes(document, "pgMar")[0]
  expect(
    ["top", "right", "bottom", "left"].map((side) =>
      wordAttribute(margin, side)
    )
  ).toEqual(["240", "480", "720", "960"])
})
