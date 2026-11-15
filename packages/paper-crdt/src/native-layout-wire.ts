import * as Y from "yjs"
import { isWellFormed } from "@workspace/domain/internal/paper-presentation"
import { validateMark, validateNodeAttrs } from "./native-formatting-wire.js"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"

const inline = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "paperCvField",
]
const owners = [
  "paperCvHeader",
  "paperCvSection",
  "paperCvExperience",
  "paperCvEducation",
  "paperCvSkills",
]
const content = [...inline, ...owners, "divider"]
const layouts = ["paperFlow", "paperTable", "paperRow", "paperCell"]

export function validateLayoutWire(
  fragment: Y.XmlFragment,
  engine: PrivateLayoutEditor
): void {
  const ids = new Set<string>()
  const visit = (parent: Y.XmlFragment, container: string) => {
    const children = parent.toArray()
    const name = parent instanceof Y.XmlElement ? parent.nodeName : "root"
    const only = (names: readonly string[]) =>
      children.every(
        (child) =>
          child instanceof Y.XmlElement && names.includes(child.nodeName)
      )
    if (name === "root" && (children.length !== 1 || !only(["blockGroup"])))
      throw new Error("Invalid layout root")
    if (
      name === "blockGroup" &&
      (container === "root"
        ? children.length !== 1 || !only(["paperFlow"])
        : !only(["blockContainer"]))
    )
      throw new Error("Invalid layout group")
    if (
      name === "paperFlow" &&
      (!children.length || !only(["blockContainer", "paperTable"]))
    )
      throw new Error("Invalid flow")
    if (name === "paperTable" && (!children.length || !only(["paperRow"])))
      throw new Error("Invalid table")
    if (name === "paperRow" && (!children.length || !only(["paperCell"])))
      throw new Error("Invalid row")
    if (name === "paperCell" && (!children.length || !only(["blockContainer"])))
      throw new Error("Invalid cell")
    if (name === "blockContainer") {
      const [body, group] = children
      if (
        children.length < 1 ||
        children.length > 2 ||
        !(body instanceof Y.XmlElement) ||
        !content.includes(body.nodeName)
      )
        throw new Error("Invalid content container")
      if (
        group &&
        (!(group instanceof Y.XmlElement) ||
          group.nodeName !== "blockGroup" ||
          ![...owners, "bulletListItem", "numberedListItem"].includes(
            body.nodeName
          ))
      )
        throw new Error("Invalid content children")
    }
    if (inline.includes(name)) {
      if (
        !children.every(
          (child) =>
            child instanceof Y.XmlText ||
            (child instanceof Y.XmlElement && child.nodeName === "hardBreak")
        )
      )
        throw new Error("Invalid inline layout content")
    } else if ([...content, "hardBreak"].includes(name) && children.length)
      throw new Error("Invalid noninline content")
    for (const child of children) {
      if (child instanceof Y.XmlElement) {
        validateNodeAttrs(child.nodeName, child.getAttributes(), engine)
        if (
          child.nodeName === "blockContainer" ||
          layouts.includes(child.nodeName)
        ) {
          const id = child.getAttribute("id")
          if (
            typeof id !== "string" ||
            !/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
            ids.has(id)
          )
            throw new Error("Missing or duplicate layout identity")
          ids.add(id)
        }
        if (
          ![
            "blockGroup",
            "blockContainer",
            "hardBreak",
            ...content,
            ...layouts,
          ].includes(child.nodeName)
        )
          throw new Error("Unknown layout node")
        visit(child, name)
      } else if (child instanceof Y.XmlText && inline.includes(name)) {
        for (const delta of child.toDelta()) {
          if (typeof delta.insert !== "string" || !isWellFormed(delta.insert))
            throw new Error("Malformed layout text")
          for (const [key, value] of Object.entries(delta.attributes ?? {}))
            validateMark(key, value, engine)
        }
      } else throw new Error("Unknown layout wire content")
    }
  }
  visit(fragment, "root")
}
