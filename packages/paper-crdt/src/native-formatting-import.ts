import { BlockNoteEditor } from "@blocknote/core"
import * as Y from "yjs"
import {
  formattedDocumentSchema,
  documentPresentationSchema,
  canonical,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import { openNativeCvDocument, materializeNativeCv } from "./native-cv.js"
import {
  ownFormattingBinding,
  type EngineBinding,
} from "./presentation-binding.js"
import { nativeFormattingSchema } from "./native-formatting-schema.js"
import {
  attempt,
  formattingFragmentName,
  openFormattedBinary,
  readFormatting,
} from "./native-formatting.js"
import {
  FORMATTING_PROFILE,
  writePresentationMeta,
  PRESENTATION_META,
} from "./presentation-meta.js"
export function openPrivateFormatting(
  source: Uint8Array,
  kind: "cv" | "letter",
  defaults: unknown
): Result<EngineBinding> {
  return attempt(() => {
    const probe = new Y.Doc()
    try {
      Y.applyUpdate(probe, source)
      const paper = probe.getMap<unknown>("paper")
      if (paper.get("formattingProfile") === FORMATTING_PROFILE)
        return openFormattedBinary(source, kind)
      if (
        paper.has("formattingProfile") ||
        paper.has(PRESENTATION_META) ||
        kind !== "cv"
      )
        throw new Error("Unsupported or mixed legacy profile")
    } finally {
      probe.destroy()
    }
    const legacy = openNativeCvDocument(source)
    try {
      const old = materializeNativeCv(legacy)
      const decorate = (input: unknown): unknown => {
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new Error("Invalid legacy node")
        const value: Record<string, unknown> = Object.fromEntries(
          Object.entries(input)
        )
        if (Array.isArray(value.content)) value.paragraph = {}
        if (Array.isArray(value.children))
          value.children = value.children.map(decorate)
        return value
      }
      const candidate = formattedDocumentSchema.parse({
        profile: FORMATTING_PROFILE,
        kind: "cv",
        presentation: documentPresentationSchema.parse(defaults),
        header: decorate(old.header),
        blocks: old.blocks.map(decorate),
      })
      const doc = new Y.Doc()
      try {
        Y.applyUpdate(doc, source)
        const fragment = doc.getXmlFragment(formattingFragmentName(kind))
        const upgrade = (parent: Y.XmlFragment) => {
          for (const child of parent.toArray()) {
            if (child instanceof Y.XmlText) {
              let offset = 0
              for (const delta of child.toDelta()) {
                if (typeof delta.insert !== "string")
                  throw new Error("Legacy embedding")
                const attrs: Record<string, unknown> = {}
                for (const name of ["bold", "italic", "underline"])
                  if (delta.attributes?.[name] !== undefined)
                    attrs[name] = { stringValue: "on" }
                if (Object.keys(attrs).length)
                  child.format(offset, delta.insert.length, attrs)
                offset += delta.insert.length
              }
            } else if (child instanceof Y.XmlElement) upgrade(child)
            else throw new Error("Legacy embedding")
          }
        }
        doc.transact(() => {
          upgrade(fragment)
          writePresentationMeta(doc, candidate.presentation)
          doc
            .getMap<unknown>("paper")
            .set("formattingProfile", FORMATTING_PROFILE)
        }, "private-formatting-import")
        const binding = ownFormattingBinding({
          doc,
          fragment,
          kind,
          engine: BlockNoteEditor.create({ schema: nativeFormattingSchema }),
        })
        if (canonical(readFormatting(binding)) !== canonical(candidate))
          throw new Error("Legacy transition changes semantics")
        return binding
      } catch (error) {
        doc.destroy()
        throw error
      }
    } finally {
      legacy.destroy()
    }
  })
}
