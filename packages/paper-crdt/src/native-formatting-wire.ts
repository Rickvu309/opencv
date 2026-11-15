import { isSafeHref } from "@workspace/domain"
import * as Y from "yjs"
import { isWellFormed } from "@workspace/domain/internal/paper-presentation"
import type { PrivateFormattingEditor } from "./native-formatting-schema.js"
import { canonicalStyles } from "./native-formatting-styles.js"
import { object } from "./native-formatting-inline.js"
import { canonicalProps, formattingProps } from "./native-formatting-props.js"
export function validateFormattingWire(
  fragment: Y.XmlFragment,
  engine: PrivateFormattingEditor
): void {
  const contentNames = [
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "divider",
    "paperCvHeader",
    "paperCvSection",
    "paperCvExperience",
    "paperCvEducation",
    "paperCvSkills",
    "paperCvField",
  ]
  const inlineNames = [
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "paperCvField",
  ]
  const ids = new Set<string>()
  const visit = (parent: Y.XmlFragment) => {
    const children = parent.toArray()
    const name = parent instanceof Y.XmlElement ? parent.nodeName : "root"
    const only = (names: readonly string[]) =>
      children.every(
        (c) => c instanceof Y.XmlElement && names.includes(c.nodeName)
      )
    if (name === "root" && (children.length !== 1 || !only(["blockGroup"])))
      throw new Error("Invalid formatting root")
    if (name === "blockGroup" && !only(["blockContainer"]))
      throw new Error("Invalid block group")
    if (name === "blockContainer") {
      const [content, nested] = children
      if (
        children.length < 1 ||
        children.length > 2 ||
        !(content instanceof Y.XmlElement) ||
        !contentNames.includes(content.nodeName)
      )
        throw new Error("Invalid container")
      if (
        nested &&
        (!(nested instanceof Y.XmlElement) ||
          nested.nodeName !== "blockGroup" ||
          ![
            "paperCvHeader",
            "paperCvSection",
            "paperCvExperience",
            "paperCvEducation",
            "paperCvSkills",
            "bulletListItem",
            "numberedListItem",
          ].includes(content.nodeName))
      )
        throw new Error("Invalid child group")
    }
    if (inlineNames.includes(name)) {
      if (
        !children.every(
          (c) =>
            c instanceof Y.XmlText ||
            (c instanceof Y.XmlElement && c.nodeName === "hardBreak")
        )
      )
        throw new Error("Invalid inline embedding")
      if (parent instanceof Y.XmlElement) canonicalProps(parent.getAttributes())
    } else if ([...contentNames, "hardBreak"].includes(name) && children.length)
      throw new Error("Noninline content")
    for (const child of children) {
      if (child instanceof Y.XmlElement) {
        validateNodeAttrs(child.nodeName, child.getAttributes(), engine)
        if (child.nodeName === "blockContainer") {
          const id = child.getAttribute("id")
          if (typeof id !== "string" || ids.has(id))
            throw new Error("Missing or duplicate container ID")
          ids.add(id)
        }
        visit(child)
      } else if (child instanceof Y.XmlText) {
        for (const delta of child.toDelta()) {
          if (typeof delta.insert !== "string" || !isWellFormed(delta.insert))
            throw new Error("Malformed text or embed")
          for (const [key, value] of Object.entries(delta.attributes ?? {}))
            validateMark(key, value, engine)
        }
      } else throw new Error("Unknown wire child")
    }
  }
  visit(fragment)
}
export function validateNodeAttrs(
  name: string,
  attrs: Record<string, unknown>,
  engine: Pick<PrivateFormattingEditor, "pmSchema">
) {
  const spec = engine.pmSchema.nodes[name]
  if (!spec) throw new Error("Unknown wire node")
  const allowed = spec.spec.attrs ?? {}
  const inline = [
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "paperCvField",
  ].includes(name)
  for (const [key, value] of Object.entries(attrs)) {
    if (!(key in allowed)) throw new Error("Unknown wire attribute")
    const semantic =
      (name === "blockContainer" && key === "id") ||
      (["paperFlow", "paperTable", "paperRow", "paperCell"].includes(name) &&
        key === "id") ||
      (name === "paperTable" && key === "columns") ||
      (name === "paperCell" && key === "columnId") ||
      (name === "heading" && key === "level") ||
      (name === "paperCvHeader" && key === "photo") ||
      (name === "paperCvSection" && key === "kind") ||
      (name === "paperCvField" &&
        ["ownerId", "fieldKey", "itemId"].includes(key)) ||
      (inline && key in formattingProps)
    if (!semantic && value !== allowed[key]?.default)
      throw new Error("Unexpected wire attribute")
  }
  if (
    name === "blockContainer" &&
    (typeof attrs.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(attrs.id))
  )
    throw new Error("Missing container ID")
  if (name === "heading" && attrs.level !== 2 && attrs.level !== 3)
    throw new Error("Invalid heading")
  if (inline) canonicalProps(attrs)
}
export function validateMark(
  key: string,
  value: unknown,
  engine: Pick<PrivateFormattingEditor, "pmSchema">
) {
  const attrs = object(value)
  const spec = engine.pmSchema.marks[key]
  if (!spec) throw new Error("Unknown wire mark")
  if (key === "link") {
    if (typeof attrs.href !== "string" || !isSafeHref(attrs.href))
      throw new Error("Unsafe link")
    for (const [name, item] of Object.entries(attrs))
      if (
        !(name in (spec.spec.attrs ?? {})) ||
        (name !== "href" && item !== spec.spec.attrs?.[name]?.default)
      )
        throw new Error("Unknown link attribute")
  } else {
    object(attrs, ["stringValue"])
    canonicalStyles({ [key]: attrs.stringValue })
  }
}
export function validateFormattingEngine(
  engine: PrivateFormattingEditor
): void {
  const doc = engine.prosemirrorState.doc
  if (doc.type.name !== "doc") throw new Error("Unknown engine document")
  validateNodeAttrs(doc.type.name, doc.attrs, engine)
  const ids = new Set<string>()
  doc.descendants((node) => {
    if (node.isText) {
      if (!node.text || !isWellFormed(node.text))
        throw new Error("Malformed engine text")
      for (const mark of node.marks)
        validateMark(mark.type.name, mark.attrs, engine)
    } else {
      if (
        ![
          "blockGroup",
          "blockContainer",
          "paragraph",
          "heading",
          "bulletListItem",
          "numberedListItem",
          "divider",
          "paperCvHeader",
          "paperCvSection",
          "paperCvExperience",
          "paperCvEducation",
          "paperCvSkills",
          "paperCvField",
          "hardBreak",
        ].includes(node.type.name)
      )
        throw new Error("Unknown engine node")
      if (node.marks.length)
        throw new Error("Unsupported marked engine embedding")
      validateNodeAttrs(node.type.name, node.attrs, engine)
      if (node.type.name === "blockContainer") {
        const id = node.attrs.id
        if (typeof id !== "string" || ids.has(id))
          throw new Error("Duplicate engine ID")
        ids.add(id)
      }
    }
  })
}
