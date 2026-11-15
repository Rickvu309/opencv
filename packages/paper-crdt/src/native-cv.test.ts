import { BlockNoteEditor } from "@blocknote/core"
import {
  cvSlots,
  nativeCvDocumentSchema,
  type NativeCvDocument,
  blankCv,
  nativePaperFromLegacy,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"
import * as Y from "yjs"

import {
  nativeCvSchema,
  toNativeCvBlocks,
  fromNativeCvBlocks,
  openNativeCvDocument,
  writeNativeCvDocument,
  writeNativeCvBlocks,
  materializeNativeCv,
  seedYDoc,
  writeDocument,
  writeAsEditor,
} from "./index.js"

function owner(id: string, type: keyof typeof cvSlots) {
  return {
    id,
    type,
    ...(type === "section" ? { kind: "experience" } : {}),
    ...(type === "header" ? { photo: "file:photo" } : {}),
    children: cvSlots[type].map((fieldKey, index) => ({
      id: `${id}-${fieldKey}`,
      type: "cvField",
      ownerId: id,
      fieldKey,
      content: index
        ? []
        : [
            {
              text: "  Việt e\u0302 😀 ",
              bold: true,
              italic: true,
              underline: true,
              href: "https://example.com/a",
            },
            { text: " linked", underline: true, href: "mailto:a@example.com" },
            { text: " " },
          ],
    })),
  }
}
function document(): NativeCvDocument {
  const skills = owner("skills", "skills")
  return nativeCvDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    kind: "cv",
    header: owner("h", "header"),
    blocks: [
      { id: "lead", type: "paragraph", content: [{ text: "Leading prose" }] },
      owner("s1", "section"),
      owner("s2", "section"),
      owner("exp", "experience"),
      owner("edu", "education"),
      {
        ...skills,
        children: [
          ...skills.children,
          ...["a", "b"].map((id) => ({
            id: `field-${id}`,
            itemId: `item-${id}`,
            type: "cvField",
            ownerId: "skills",
            fieldKey: "item",
            content: [{ text: "same", bold: true }],
          })),
        ],
      },
      { id: "heading", type: "heading", level: 2, content: [] },
      {
        id: "list",
        type: "bullet",
        content: [{ text: "Body\tline\nnext" }],
        children: [
          { id: "nested", type: "numbered", content: [], children: [] },
        ],
      },
      { id: "divider", type: "divider" },
      owner("s3", "section"),
    ],
  })
}

describe("private rich CV real engine codec", () => {
  it("roundtrips complete semantic fields and ordered body through both actual writers and binary reload", () => {
    const target = document()
    const semantic = openNativeCvDocument()
    const ordinary = openNativeCvDocument()
    try {
      writeNativeCvDocument(semantic, target, "semantic")
      writeNativeCvBlocks(ordinary, toNativeCvBlocks(target), "ordinary")
      expect(materializeNativeCv(semantic)).toEqual(target)
      expect(materializeNativeCv(ordinary)).toEqual(target)
      expect(materializeNativeCv(Y.encodeStateAsUpdate(ordinary))).toEqual(
        target
      )
      expect(fromNativeCvBlocks(toNativeCvBlocks(target))).toEqual(target)
    } finally {
      semantic.destroy()
      ordinary.destroy()
    }
  })
  it("represents actual engine-edited field content without stale scalar wrappers", () => {
    const engine = BlockNoteEditor.create({
      schema: nativeCvSchema,
      initialContent: toNativeCvBlocks(document()),
    })
    engine.updateBlock("h-name", {
      content: [
        {
          type: "link",
          href: "https://example.com/new",
          content: [
            {
              type: "text",
              text: "New name",
              styles: { bold: true, underline: true },
            },
          ],
        },
      ],
    })
    const candidate = fromNativeCvBlocks(engine.document)
    const doc = openNativeCvDocument()
    try {
      writeNativeCvBlocks(doc, engine.document, "person")
      expect(materializeNativeCv(doc)).toEqual(candidate)
      writeNativeCvDocument(doc, candidate, "semantic")
      expect(materializeNativeCv(doc)).toEqual(candidate)
      const field = candidate.header.children[0]
      expect(field && field.type === "cvField" && field.content[0]?.text).toBe(
        "New name"
      )
    } finally {
      doc.destroy()
    }
  })
  it("reorders duplicate skill labels with stable field and item identities", () => {
    const target = document()
    const skills = target.blocks.find((block) => block.type === "skills")
    if (!skills || skills.type !== "skills") throw new Error("Missing skills")
    const doc = openNativeCvDocument()
    try {
      writeNativeCvDocument(doc, target, "seed")
      skills.children = [
        skills.children[0],
        skills.children[2],
        skills.children[1],
      ].filter((item) => item !== undefined)
      writeNativeCvDocument(doc, target, "reorder", new Set(["field-b"]))
      expect(materializeNativeCv(doc)).toEqual(target)
      writeNativeCvBlocks(doc, toNativeCvBlocks(target), "ordinary")
      expect(materializeNativeCv(doc)).toEqual(target)
    } finally {
      doc.destroy()
    }
  })
  it("refuses malformed ordinary and semantic candidates without any live update", () => {
    const doc = openNativeCvDocument()
    try {
      writeNativeCvDocument(doc, document(), "seed")
      const before = Y.encodeStateAsUpdate(doc)
      let updates = 0
      doc.on("update", () => {
        updates += 1
      })
      const blocks = toNativeCvBlocks(document())
      const header = blocks[0]
      if (!header || header.type !== "paperCvHeader" || !header.children)
        throw new Error("Missing header")
      const firstField = header.children[0]
      if (!firstField || firstField.type !== "paperCvField")
        throw new Error("Missing field")
      for (const malformed of [
        [
          { ...blocks[0], props: { name: "scalar mirror" } },
          ...blocks.slice(1),
        ],
        [{ ...blocks[0], children: [] }, ...blocks.slice(1)],
        [
          { ...blocks[0], children: [{ id: "unknown", type: "table" }] },
          ...blocks.slice(1),
        ],
        [
          {
            ...header,
            children: [
              {
                ...firstField,
                content: [
                  { type: "text", text: "x", styles: { strike: true } },
                ],
              },
              ...header.children.slice(1),
            ],
          },
          ...blocks.slice(1),
        ],
      ])
        expect(() => writeNativeCvBlocks(doc, malformed, "bad")).toThrow()
      expect(() =>
        writeNativeCvDocument(
          doc,
          { ...document(), schemaRevision: 1 } as never,
          "bad"
        )
      ).toThrow()
      expect(updates).toBe(0)
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    } finally {
      doc.destroy()
    }
  })
  it("refuses unknown binary marks before engine normalization and refuses shared public documents", () => {
    const doc = openNativeCvDocument()
    const publicDoc = new Y.Doc()
    try {
      writeNativeCvDocument(doc, document(), "seed")
      const visit = (
        node: Y.XmlFragment | Y.XmlElement
      ): Y.XmlText | undefined => {
        for (const child of node.toArray()) {
          if (child instanceof Y.XmlText && child.length) return child
          if (child instanceof Y.XmlElement) {
            const found = visit(child)
            if (found) return found
          }
        }
        return undefined
      }
      const text = visit(doc.getXmlFragment("private-native-cv-v4-r2"))
      if (!text) throw new Error("Missing wire text")
      text.format(0, 1, { strike: {} })
      expect(() => materializeNativeCv(Y.encodeStateAsUpdate(doc))).toThrow()
      const before = Y.encodeStateAsUpdate(publicDoc)
      expect(() =>
        writeNativeCvDocument(publicDoc, document(), "bad")
      ).toThrow()
      expect(Y.encodeStateAsUpdate(publicDoc)).toEqual(before)
    } finally {
      doc.destroy()
      publicDoc.destroy()
    }
  })
  it("keeps accepted legacy writers from accepting private revision 2", () => {
    expect(() => seedYDoc(document() as never)).toThrow()
    const doc = new Y.Doc()
    try {
      expect(() => writeDocument(doc, document() as never, "bad")).toThrow()
    } finally {
      doc.destroy()
    }
  })
  it("keeps accepted revision-1 ordinary and semantic writers closed to the private revision", () => {
    const doc = new Y.Doc()
    try {
      Y.applyUpdate(doc, seedYDoc(nativePaperFromLegacy(blankCv())))
      const before = Y.encodeStateAsUpdate(doc)
      expect(() => writeDocument(doc, document() as never, "bad")).toThrow()
      expect(() => writeAsEditor(doc, document() as never, "bad")).toThrow()
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    } finally {
      doc.destroy()
    }
  })
  it("supports raw private origin Undo while retaining a later edit to a separate field", () => {
    const doc = openNativeCvDocument()
    const undo = new Y.UndoManager(
      doc.getXmlFragment("private-native-cv-v4-r2"),
      { trackedOrigins: new Set(["coach"]), captureTimeout: 0 }
    )
    try {
      writeNativeCvDocument(doc, document(), "seed")
      const changed = toNativeCvBlocks(document())
      const header = changed[0]
      if (!header || header.children?.[0]?.type !== "paperCvField")
        throw new Error("Missing header")
      header.children[0] = {
        ...header.children[0],
        content: [{ type: "text", text: "Coach", styles: { bold: true } }],
      }
      writeNativeCvBlocks(doc, changed, "coach")
      const later = toNativeCvBlocks(materializeNativeCv(doc))
      const laterHeader = later[0]
      if (!laterHeader || laterHeader.children?.[1]?.type !== "paperCvField")
        throw new Error("Missing headline")
      laterHeader.children[1] = {
        ...laterHeader.children[1],
        content: [
          { type: "text", text: "Person headline", styles: { italic: true } },
        ],
      }
      writeNativeCvBlocks(doc, later, "person")
      undo.undo()
      const result = materializeNativeCv(doc)
      expect(result.header.children[0]).toEqual(document().header.children[0])
      expect(result.header.children[1]).toEqual(
        fromNativeCvBlocks(later).header.children[1]
      )
    } finally {
      undo.destroy()
      doc.destroy()
    }
  })

  it("refuses malformed raw nodes, structure and attribute values without changing the source bytes", () => {
    const source = openNativeCvDocument()
    try {
      writeNativeCvDocument(source, document(), "seed")
      const valid = Y.encodeStateAsUpdate(source)
      const mutations: ((fragment: Y.XmlFragment) => void)[] = [
        (fragment) => fragment.insert(0, [new Y.XmlElement("unknown")]),
        (fragment) => {
          const group = fragment.get(0)
          if (!(group instanceof Y.XmlElement)) throw new Error("Missing group")
          group.insert(0, [new Y.XmlElement("paragraph")])
        },
        (fragment) => {
          const group = fragment.get(0)
          if (!(group instanceof Y.XmlElement)) throw new Error("Missing group")
          group.setAttribute("unknown", "discarded")
        },
        (fragment) => {
          const visit = (parent: Y.XmlFragment | Y.XmlElement): boolean => {
            for (const child of parent.toArray()) {
              if (child instanceof Y.XmlText && child.length) {
                child.format(0, 1, { link: { href: "javascript:bad" } })
                return true
              }
              if (child instanceof Y.XmlElement && visit(child)) return true
            }
            return false
          }
          if (!visit(fragment)) throw new Error("Missing text")
        },
      ]
      for (const mutate of mutations) {
        const detached = new Y.Doc()
        try {
          Y.applyUpdate(detached, valid)
          mutate(detached.getXmlFragment("private-native-cv-v4-r2"))
          const malformed = Y.encodeStateAsUpdate(detached)
          expect(() => materializeNativeCv(malformed)).toThrow()
          expect(Y.encodeStateAsUpdate(detached)).toEqual(malformed)
          expect(Y.encodeStateAsUpdate(source)).toEqual(valid)
        } finally {
          detached.destroy()
        }
      }
    } finally {
      source.destroy()
    }
  })
})
