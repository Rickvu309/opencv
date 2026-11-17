import * as Y from "yjs"
import type {
  FormatTarget,
  FormatNode,
  PrivateFormattedDocument,
} from "@workspace/domain/internal/paper-presentation"
import type { PrivateFormattingEditor } from "./native-formatting-schema.js"
export type EngineBinding = Readonly<{
  doc: Y.Doc
  fragment: Y.XmlFragment
  engine: PrivateFormattingEditor
  kind: "cv" | "letter"
}>
const owned = new WeakSet<EngineBinding>()
export function ownFormattingBinding(binding: EngineBinding): EngineBinding {
  owned.add(binding)
  return binding
}
export function assertFormattingBinding(binding: EngineBinding): void {
  if (!owned.has(binding) || binding.fragment.doc !== binding.doc)
    throw new Error("Foreign formatting binding")
}
export function canonicalTarget(
  doc: PrivateFormattedDocument,
  target: FormatTarget
): FormatNode {
  const matches: FormatNode[] = []
  const visit = (node: FormatNode, parent?: FormatNode) => {
    if (
      target.kind === "body" &&
      node.id === target.blockId &&
      "content" in node &&
      node.type !== "cvField"
    )
      matches.push(node)
    if (
      target.kind === "cv-field" &&
      node.type === "cvField" &&
      node.id === target.fieldId &&
      node.ownerId === target.ownerId &&
      node.fieldKey === target.fieldKey &&
      node.itemId === target.itemId &&
      parent?.id === target.ownerId
    )
      matches.push(node)
    if ("children" in node) node.children.forEach((child) => visit(child, node))
  }
  if (doc.kind === "cv" && doc.header) visit(doc.header)
  doc.blocks.forEach((n) => visit(n))
  const node = matches[0]
  if (matches.length !== 1 || !node)
    throw new Error("Missing or conflicting semantic target")
  return node
}
export function resolveFormattingTarget(
  binding: EngineBinding,
  target: FormatTarget
) {
  assertFormattingBinding(binding)
  const id = target.kind === "body" ? target.blockId : target.fieldId
  const found: {
    container: Y.XmlElement<Record<string, string | number | boolean>>
    content: Y.XmlElement<Record<string, string | number | boolean>>
  }[] = []
  const walk = (parent: Y.XmlFragment) => {
    for (const child of parent.toArray())
      if (child instanceof Y.XmlElement) {
        if (
          child.nodeName === "blockContainer" &&
          child.getAttribute("id") === id
        ) {
          const content = child.get(0)
          if (!(content instanceof Y.XmlElement))
            throw new Error("Missing engine content")
          found.push({ container: child, content })
        }
        walk(child)
      }
  }
  walk(binding.fragment)
  if (found.length !== 1 || !found[0])
    throw new Error("Missing or ambiguous blockContainer identity")
  return { target, ...found[0] }
}
