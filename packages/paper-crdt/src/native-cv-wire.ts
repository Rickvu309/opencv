import { isSafeHref } from "@workspace/domain"
import * as Y from "yjs"

import type { NativeCvEditor } from "./native-cv-schema.js"

export function validateNativeCvWire(
  fragment: Y.XmlFragment,
  engine: NativeCvEditor
): void {
  const visit = (parent: Y.XmlFragment | Y.XmlElement) => {
    const children = parent.toArray()
    const name = parent instanceof Y.XmlElement ? parent.nodeName : "root"
    const elements = (names: readonly string[]) =>
      children.every(
        (child) =>
          child instanceof Y.XmlElement && names.includes(child.nodeName)
      )
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
    if (name === "root" && (children.length !== 1 || !elements(["blockGroup"])))
      throw new Error("Invalid CV wire root")
    if (name === "blockGroup" && !elements(["blockContainer"]))
      throw new Error("Invalid CV wire group")
    if (name === "blockContainer") {
      const [content, nested] = children
      if (
        children.length < 1 ||
        children.length > 2 ||
        !(content instanceof Y.XmlElement) ||
        !contentNames.includes(content.nodeName)
      )
        throw new Error("Invalid CV wire container")
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
        throw new Error("Invalid CV wire children")
    }
    if (
      [
        "paperCvHeader",
        "paperCvSection",
        "paperCvExperience",
        "paperCvEducation",
        "paperCvSkills",
        "divider",
        "hardBreak",
      ].includes(name) &&
      children.length
    )
      throw new Error("Non-inline CV wire content")
    if (
      contentNames.includes(name) &&
      children.some(
        (child) =>
          !(child instanceof Y.XmlText) &&
          (!(child instanceof Y.XmlElement) || child.nodeName !== "hardBreak")
      )
    )
      throw new Error("Invalid CV wire inline")
    for (const child of children) {
      if (child instanceof Y.XmlElement) {
        const spec = engine.pmSchema.nodes[child.nodeName]
        if (!spec) throw new Error("Unknown CV wire node")
        const allowed = spec.spec.attrs ?? {}
        if (Object.keys(child.getAttributes()).some((key) => !(key in allowed)))
          throw new Error("Unknown CV wire attribute")
        const carried =
          child.nodeName === "blockContainer"
            ? ["id"]
            : child.nodeName === "heading"
              ? ["level"]
              : child.nodeName.startsWith("paperCv")
                ? Object.keys(allowed)
                : []
        if (
          Object.entries(child.getAttributes()).some(([key, value]) =>
            carried.includes(key)
              ? key === "id"
                ? typeof value !== "string"
                : typeof value !== typeof allowed[key]?.default
              : value !== allowed[key]?.default
          )
        )
          throw new Error("Unsupported CV wire attribute value")
        visit(child)
      } else if (child instanceof Y.XmlText) {
        for (const delta of child.toDelta()) {
          if (typeof delta.insert !== "string")
            throw new Error("Unknown CV wire embed")
          for (const [name, value] of Object.entries(delta.attributes ?? {})) {
            const spec = engine.pmSchema.marks[name]
            if (
              !spec ||
              !["bold", "italic", "underline", "link"].includes(name)
            )
              throw new Error("Unknown CV wire mark")
            if (!value || typeof value !== "object" || Array.isArray(value))
              throw new Error("Invalid CV wire mark")
            const attrs = Object.fromEntries(Object.entries(value))
            if (
              Object.keys(attrs).some(
                (key) => !(key in (spec.spec.attrs ?? {}))
              )
            )
              throw new Error("Unknown CV wire mark attribute")
            if (
              Object.entries(attrs).some(
                ([key, value]) =>
                  key !== "href" && value !== spec.spec.attrs?.[key]?.default
              )
            )
              throw new Error("Unsupported CV wire mark attribute")
            if (
              name === "link" &&
              (typeof attrs.href !== "string" || !isSafeHref(attrs.href))
            )
              throw new Error("Unsafe CV wire link")
          }
        }
      } else throw new Error("Unknown CV wire child")
    }
  }
  visit(fragment)
}
