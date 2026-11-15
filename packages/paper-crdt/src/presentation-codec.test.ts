import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import { cvSlots, nativeCvDocumentSchema } from "@workspace/domain"
import {
  formatTargetSchema,
  formattedDocumentSchema,
  type Result,
  type PrivateFormattedDocument,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateFormatting,
  readFormatting,
  readPrivateFormatting,
  writePrivateFormatting,
  writePrivateFormattingBlocks,
  openFormattedBinary,
} from "./native-formatting.js"
import { toFormattingBlocks } from "./native-formatting-cv.js"
import {
  prepareFormatting,
  applyFormatting,
  reverseFormatting,
} from "./presentation-codec.js"
import {
  canonicalTarget,
  resolveFormattingTarget,
  type EngineBinding,
} from "./presentation-binding.js"
import { textSpans, selectedRuns } from "./presentation-inline.js"
import { openPrivateFormatting } from "./native-formatting-import.js"
import {
  openNativeCvDocument,
  writeNativeCvDocument,
  materializeNativeCv,
} from "./native-cv.js"
const docs = new Set<Y.Doc>()
afterEach(() => {
  for (const doc of docs) doc.destroy()
  docs.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
const presentation = {
  codecVersion: 1,
  page: {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  },
  inline: { fontId: "liberation-serif", bold: true },
  paragraph: {},
  styles: [],
}
const target = formatTargetSchema.parse({ kind: "body", blockId: "body" })
function snapshot(): PrivateFormattedDocument {
  return formattedDocumentSchema.parse({
    profile: "private-formatting-1",
    kind: "letter",
    presentation,
    blocks: [
      {
        id: "body",
        type: "paragraph",
        paragraph: { alignment: "justify", before: 120, keepNext: false },
        content: [
          {
            text: "Việt e\u0302 😀 English",
            bold: false,
            italic: true,
            underline: true,
            strike: false,
            color: "#123456",
            highlight: "#FFEEDD",
            fontId: "liberation-sans",
            size: 240,
            href: "https://example.com/a",
          },
          { text: " end", bold: true },
        ],
      },
      { id: "heading", type: "heading", level: 2, paragraph: {}, content: [] },
      {
        id: "list",
        type: "bullet",
        paragraph: {},
        content: [{ text: "tab\tline\nnext" }],
        children: [
          {
            id: "nested",
            type: "numbered",
            paragraph: {},
            content: [],
            children: [],
          },
        ],
      },
      { id: "divider", type: "divider" },
    ],
  })
}
function binding() {
  const result = value(createPrivateFormatting(snapshot()))
  docs.add(result.doc)
  return result
}
function body(binding: EngineBinding) {
  const node = canonicalTarget(readFormatting(binding), target)
  if (!("content" in node)) throw new Error("Missing content")
  return node
}
function patch(binding: EngineBinding, values: object, from = 0, to = 4) {
  return value(
    applyFormatting(
      binding,
      value(
        prepareFormatting(binding, {
          kind: "inline",
          range: { target, from, to },
          expected: selectedRuns(body(binding).content, from, to),
          values,
        })
      )
    )
  )
}
function unchanged(binding: EngineBinding, work: () => unknown) {
  const bytes = Y.encodeStateAsUpdate(binding.doc),
    vector = Y.encodeStateVector(binding.doc),
    before = readFormatting(binding)
  let updates = 0
  const count = () => updates++
  binding.doc.on("update", count)
  try {
    work()
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
    expect(Y.encodeStateVector(binding.doc)).toEqual(vector)
    expect(readFormatting(binding)).toEqual(before)
    expect(updates).toBe(0)
  } finally {
    binding.doc.off("update", count)
  }
}
describe("private real-engine presentation codec", () => {
  it("roundtrips complete marks, links, empty nodes, geometry and exact UTF16 through fresh binary docs", () => {
    const source = binding(),
      before = readFormatting(source)
    expect(before).toEqual(snapshot())
    expect(
      value(
        writePrivateFormattingBlocks(
          source,
          toFormattingBlocks(before),
          "ordinary"
        )
      )
    ).toBeUndefined()
    expect(readFormatting(source)).toEqual(before)
    const bytes = Y.encodeStateAsUpdate(source.doc)
    source.doc.destroy()
    docs.delete(source.doc)
    const fresh = openFormattedBinary(bytes, "letter")
    docs.add(fresh.doc)
    expect(readFormatting(fresh)).toEqual(before)
    expect(
      resolveFormattingTarget(fresh, target).container.getAttribute("id")
    ).toBe("body")
  })
  it("formats existing XML text in one transaction and supports actual Yjs Undo and Redo", () => {
    const source = binding(),
      before = readFormatting(source)
    const text = textSpans(resolveFormattingTarget(source, target).content)[0]!
      .text
    const undo = new Y.UndoManager(
      [source.fragment, source.doc.getMap("paper")],
      { trackedOrigins: new Set(["private-formatting-patch"]) }
    )
    let updates = 0
    source.doc.on("update", () => updates++)
    patch(source, { bold: true, color: "#ABCDEF" })
    expect(updates).toBe(1)
    expect(
      textSpans(resolveFormattingTarget(source, target).content)[0]!.text
    ).toBe(text)
    const changed = readFormatting(source)
    undo.undo()
    expect(readFormatting(source)).toEqual(before)
    undo.redo()
    expect(readFormatting(source)).toEqual(changed)
    undo.destroy()
  })
  it("selectively reverses heterogeneous marks while preserving later links, color, text and layout", () => {
    const source = binding()
    const receipt = patch(
      source,
      { bold: true },
      0,
      body(source)
        .content.map((r) => r.text)
        .join("").length
    )
    const node = resolveFormattingTarget(source, target).content
    source.doc.transact(() => {
      const text = textSpans(node)[0]!.text
      text.format(0, 4, {
        color: { stringValue: "#ABCDEF" },
        link: { href: "https://later.example" },
      })
      text.insert(text.length, " later", {})
      node.setAttribute("spaceAfter", 360)
    }, "unrelated")
    expect(reverseFormatting(source, receipt).kind).toBe("ok")
    expect(body(source).paragraph.after).toBe(360)
    const runs = body(source).content
    expect(runs[0]).toMatchObject({
      bold: false,
      color: "#ABCDEF",
      href: "https://later.example",
    })
    expect(runs.map((r) => r.text).join("")).toContain(" later")
    expect(runs.at(-1)).toEqual({ text: " later" })
    expect(
      runs.some((run) => run.text.includes(" end") && run.bold === true)
    ).toBe(true)
  })
  it("patches exact ranges across existing XML texts without replacing characters or native links", () => {
    const source = binding(),
      node = resolveFormattingTarget(source, target).content
    const original = textSpans(node)[0]!.text
    const delta = original.toDelta()
    const tail = new Y.XmlText()
    source.doc.transact(() => {
      original.delete(4, original.length - 4)
      node.insert(1, [tail])
      let offset = 0
      for (const part of delta) {
        if (typeof part.insert !== "string") throw new Error("Invalid fixture")
        const skip = Math.max(0, 4 - offset)
        if (skip < part.insert.length)
          tail.insert(tail.length, part.insert.slice(skip), part.attributes)
        offset += part.insert.length
      }
    }, "split-xml-text")
    let reads = 0
    const count = () => reads++
    source.doc.on("update", count)
    const before = readFormatting(source),
      text = body(source)
        .content.map((r) => r.text)
        .join("")
    source.doc.off("update", count)
    expect(reads).toBe(0)
    expect(textSpans(node).map((span) => span.text)).toEqual([original, tail])
    const receipt = patch(source, { italic: false }, 1, text.length - 1)
    expect(textSpans(node).map((span) => span.text)).toEqual([original, tail])
    expect(
      body(source)
        .content.map((r) => r.text)
        .join("")
    ).toBe(text)
    expect(body(source).content[0]?.href).toBe("https://example.com/a")
    expect(reverseFormatting(source, receipt).kind).toBe("ok")
    expect(readFormatting(source)).toEqual(before)
    expect(textSpans(node).map((span) => span.text)).toEqual([original, tail])
  })
  it("refuses affected-property conflicts, consumed and foreign receipts with zero mutation", () => {
    const source = binding(),
      foreign = binding()
    const receipt = patch(source, { bold: true })
    patch(source, { bold: false })
    unchanged(source, () =>
      expect(reverseFormatting(source, receipt).kind).toBe("refused")
    )
    unchanged(foreign, () =>
      expect(reverseFormatting(foreign, receipt).kind).toBe("refused")
    )
    const usable = patch(source, { italic: false })
    expect(reverseFormatting(source, usable).kind).toBe("ok")
    unchanged(source, () =>
      expect(reverseFormatting(source, usable).kind).toBe("refused")
    )
  })
  it("rechecks anchored characters after unrelated inserts and refuses deleted anchors", () => {
    const source = binding()
    const prepared = value(
      prepareFormatting(source, {
        kind: "inline",
        range: { target, from: 0, to: 4 },
        expected: selectedRuns(body(source).content, 0, 4),
        values: { strike: true },
      })
    )
    const text = textSpans(resolveFormattingTarget(source, target).content)[0]!
      .text
    text.insert(0, "prefix ", {})
    const receipt = value(applyFormatting(source, prepared))
    expect(
      body(source)
        .content.map((r) => r.text)
        .join("")
    ).toMatch(/^prefix Việt/u)
    text.delete(7, 1)
    unchanged(source, () =>
      expect(reverseFormatting(source, receipt).kind).toBe("refused")
    )
  })
  it("restores only paragraph and document properties and named style changes", () => {
    const source = binding(),
      before = body(source).paragraph
    const receipt = value(
      applyFormatting(
        source,
        value(
          prepareFormatting(source, {
            kind: "paragraph",
            target,
            expected: before,
            values: { alignment: "center" },
          })
        )
      )
    )
    resolveFormattingTarget(source, target).content.setAttribute(
      "spaceAfter",
      240
    )
    expect(reverseFormatting(source, receipt).kind).toBe("ok")
    expect(body(source).paragraph).toMatchObject({
      alignment: "justify",
      after: 240,
    })
    const doc = readFormatting(source)
    const page = value(
      applyFormatting(
        source,
        value(
          prepareFormatting(source, {
            kind: "document-page",
            expected: doc.presentation.page,
            values: { top: 720 },
          })
        )
      )
    )
    patch(source, { italic: false })
    expect(reverseFormatting(source, page).kind).toBe("ok")
    expect(readFormatting(source).presentation.page).toEqual(
      doc.presentation.page
    )
    const style = value(
      applyFormatting(
        source,
        value(
          prepareFormatting(source, {
            kind: "named-style",
            id: "accent",
            expected: null,
            values: {
              id: "accent",
              kind: "character",
              parent: null,
              values: { bold: false },
            },
          })
        )
      )
    )
    expect(readFormatting(source).presentation.styles).toHaveLength(1)
    expect(reverseFormatting(source, style).kind).toBe("ok")
    expect(readFormatting(source).presentation.styles).toEqual([])
  })
  it("rejects unknown, boolean, half-pair, tuple, surrogate and malformed candidates before persistence", () => {
    const source = binding(),
      blocks = toFormattingBlocks(readFormatting(source))
    const first = blocks[0]!
    for (const candidate of [
      [{ ...first, props: { mystery: true } }, ...blocks.slice(1)],
      [{ ...first, props: { lineKind: "exact" } }, ...blocks.slice(1)],
      [
        {
          ...first,
          content: [{ type: "text", text: "x", styles: { bold: true } }],
        },
        ...blocks.slice(1),
      ],
      [
        {
          ...first,
          content: [{ type: "text", text: "x", styles: { bold: "maybe" } }],
        },
        ...blocks.slice(1),
      ],
      [
        {
          ...first,
          content: [{ type: "link", href: "javascript:x", content: [] }],
        },
        ...blocks.slice(1),
      ],
    ])
      unchanged(source, () =>
        expect(
          writePrivateFormattingBlocks(source, candidate, "bad").kind
        ).toBe("refused")
      )
    for (const range of [
      { from: 0, to: 0 },
      { from: 8, to: 9 },
      { from: -1, to: 2 },
    ])
      unchanged(source, () =>
        expect(
          prepareFormatting(source, {
            kind: "inline",
            range: { target, ...range },
            expected: [],
            values: { bold: true },
          }).kind
        ).toBe("refused")
      )
    unchanged(source, () =>
      expect(
        prepareFormatting(source, {
          kind: "paragraph",
          target: {
            kind: "cv-field",
            ownerId: "x",
            fieldId: "body",
            fieldKey: "name",
          },
          expected: {},
          values: { alignment: "left" },
        }).kind
      ).toBe("refused")
    )
  })
  it("validates XML before permissive engine conversion and refuses malformed profiles on detached reload", () => {
    const source = binding()
    for (const mutation of [
      (copy: EngineBinding) =>
        resolveFormattingTarget(copy, target).content.setAttribute(
          "private-presentation",
          "{}"
        ),
      (copy: EngineBinding) =>
        textSpans(
          resolveFormattingTarget(copy, target).content
        )[0]!.text.format(0, 1, { bold: {} }),
      (copy: EngineBinding) =>
        textSpans(
          resolveFormattingTarget(copy, target).content
        )[0]!.text.format(0, 1, { mystery: {} }),
      (copy: EngineBinding) =>
        copy.doc.getMap("paper").set("formattingProfile", "mixed"),
      (copy: EngineBinding) =>
        resolveFormattingTarget(copy, target).container.setAttribute("id", ""),
      (copy: EngineBinding) =>
        resolveFormattingTarget(copy, target).content.insert(0, [
          new Y.XmlElement("image"),
        ]),
    ]) {
      const copy = openFormattedBinary(
        Y.encodeStateAsUpdate(source.doc),
        "letter"
      )
      docs.add(copy.doc)
      mutation(copy)
      expect(readPrivateFormatting(copy).kind).toBe("refused")
      expect(() =>
        openFormattedBinary(Y.encodeStateAsUpdate(copy.doc), "letter")
      ).toThrow()
    }
  })
  it("refuses malformed live code units before Yjs binary encoding replaces them", () => {
    const source = binding()
    textSpans(resolveFormattingTarget(source, target).content)[0]!.text.insert(
      0,
      "\uD800"
    )
    expect(readPrivateFormatting(source).kind).toBe("refused")
    const decoded = openFormattedBinary(
      Y.encodeStateAsUpdate(source.doc),
      "letter"
    )
    docs.add(decoded.doc)
    expect(
      body(decoded)
        .content.map((run) => run.text)
        .join("")
    ).toBe("\uFFFDViệt e\u0302 😀 English end")
  })
  it("strictly upgrades old r2 once in a detached same-fragment document preserving all CV identities", () => {
    const owner = (id: string, type: keyof typeof cvSlots) => ({
      id,
      type,
      ...(type === "section" ? { kind: "skills" } : {}),
      children: cvSlots[type].map((fieldKey) => ({
        id: `${id}-${fieldKey}`,
        type: "cvField",
        ownerId: id,
        fieldKey,
        content:
          fieldKey === "name"
            ? [
                {
                  text: "  Việt e\u0302 😀 ",
                  bold: true,
                  underline: true,
                  href: "https://example.com",
                },
              ]
            : [],
      })),
    })
    const old = nativeCvDocumentSchema.parse({
      version: 4,
      schemaRevision: 2,
      kind: "cv",
      header: owner("h", "header"),
      blocks: [
        owner("s1", "section"),
        owner("s2", "section"),
        owner("e", "experience"),
        owner("d", "education"),
        {
          ...owner("skills", "skills"),
          children: [
            ...owner("skills", "skills").children,
            ...["a", "b"].map((id) => ({
              id: `f-${id}`,
              type: "cvField",
              ownerId: "skills",
              fieldKey: "item",
              itemId: `i-${id}`,
              content: [{ text: "same" }],
            })),
          ],
        },
      ],
    })
    const legacy = openNativeCvDocument()
    docs.add(legacy)
    writeNativeCvDocument(legacy, old, "old-seed")
    const bytes = Y.encodeStateAsUpdate(legacy)
    const upgraded = value(openPrivateFormatting(bytes, "cv", presentation))
    docs.add(upgraded.doc)
    expect(Y.encodeStateAsUpdate(legacy)).toEqual(bytes)
    expect(materializeNativeCv(legacy)).toEqual(old)
    expect(upgraded.fragment.toArray()).toHaveLength(1)
    expect(
      [...upgraded.doc.share.keys()].filter(
        (name) => name.includes("cv") || name === "document-store"
      )
    ).toEqual(["private-native-cv-v4-r2"])
    const target = formatTargetSchema.parse({
      kind: "cv-field",
      ownerId: "skills",
      fieldId: "f-a",
      fieldKey: "item",
      itemId: "i-a",
    })
    const field = canonicalTarget(readFormatting(upgraded), target)
    expect(field).toMatchObject({
      id: "f-a",
      itemId: "i-a",
      content: [{ text: "same" }],
    })
    const receipt = value(
      applyFormatting(
        upgraded,
        value(
          prepareFormatting(upgraded, {
            kind: "inline",
            range: { target, from: 0, to: 4 },
            expected: [{ text: "same" }],
            values: { bold: false },
          })
        )
      )
    )
    const candidate = readFormatting(upgraded)
    if (candidate.kind !== "cv") throw new Error("Missing CV")
    const skills = candidate.blocks.find((n) => n.type === "skills")
    if (!skills || skills.type !== "skills") throw new Error("Missing skills")
    skills.children.reverse()
    expect(writePrivateFormatting(upgraded, candidate, "bad-order").kind).toBe(
      "refused"
    )
    const wrong = { ...target, itemId: "i-b" }
    unchanged(upgraded, () =>
      expect(
        prepareFormatting(upgraded, {
          kind: "paragraph",
          target: wrong,
          expected: {},
          values: { alignment: "center" },
        }).kind
      ).toBe("refused")
    )
    expect(reverseFormatting(upgraded, receipt).kind).toBe("ok")
    const fresh = value(
      openPrivateFormatting(
        Y.encodeStateAsUpdate(upgraded.doc),
        "cv",
        presentation
      )
    )
    docs.add(fresh.doc)
    expect(readFormatting(fresh)).toEqual(readFormatting(upgraded))
  })
})
