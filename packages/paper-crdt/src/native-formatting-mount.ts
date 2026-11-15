import { BlockNoteEditor, createExtension } from "@blocknote/core"
import { CollaborationExtension } from "@blocknote/core/yjs"
import { Plugin } from "@tiptap/pm/state"
import {
  inlineSchema,
  type InlinePresentation,
} from "@workspace/domain/internal/paper-presentation"
import {
  assertFormattingBinding,
  type EngineBinding,
} from "./presentation-binding.js"
import {
  nativeFormattingSchema,
  type PrivateFormattingEditor,
} from "./native-formatting-schema.js"
import { readFormatting } from "./native-formatting.js"
import { readPresentationMeta } from "./presentation-meta.js"
import {
  canonicalStyles,
  engineStyles,
  inlineKeys,
} from "./native-formatting-styles.js"
import { effectiveInline } from "./native-formatting-render-values.js"
import { acceptsFormattingTransaction } from "./native-formatting-transaction.js"
import { formattingDecorations } from "./native-formatting-decorations.js"

const mounted = new WeakMap<EngineBinding, PrivateFormattingEditor>()
type Toggle = "bold" | "italic" | "underline" | "strike"

export function mountPrivateFormatting(
  binding: EngineBinding,
  element: HTMLElement
) {
  assertFormattingBinding(binding)
  if (mounted.has(binding))
    throw new Error("Formatting binding is already mounted")
  const initial = readFormatting(binding)
  const presentation = createExtension({
    key: "paperFormatting",
    prosemirrorPlugins: [
      new Plugin({
        filterTransaction: (tr, state) =>
          acceptsFormattingTransaction(binding, initial, tr, state),
        props: {
          decorations: (state) =>
            formattingDecorations(state.doc, readPresentationMeta(binding.doc)),
        },
      }),
    ],
  })
  const editor = BlockNoteEditor.create({
    schema: nativeFormattingSchema,
    trailingBlock: false,
    links: { HTMLAttributes: { style: "text-decoration:none;color:inherit" } },
    extensions: [
      CollaborationExtension({
        fragment: binding.fragment,
        user: { name: "You", color: "#555555" },
      }),
      presentation,
    ],
  })
  let active = true
  const assertActive = () => {
    if (!active) throw new Error("Formatting view is unmounted")
  }
  const setInline = (input: InlinePresentation) => {
    assertActive()
    editor.addStyles(engineStyles(inlineSchema.parse(input)))
  }
  const toggle = (key: Toggle) => {
    assertActive()
    const current = effectiveInline(
      readPresentationMeta(binding.doc),
      canonicalStyles(editor.getActiveStyles())
    )
    setInline({ [key]: !current[key] })
  }
  const keydown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    const key = event.key.toLowerCase()
    const mark =
      key === "b"
        ? "bold"
        : key === "i"
          ? "italic"
          : key === "u"
            ? "underline"
            : key === "x" && event.shiftKey
              ? "strike"
              : undefined
    if (!mark) return
    event.preventDefault()
    event.stopImmediatePropagation()
    toggle(mark)
  }
  const refresh = () => {
    if (active) editor.prosemirrorView.dispatch(editor.prosemirrorState.tr)
  }
  try {
    editor.mount(element)
    mounted.set(binding, editor)
    element.addEventListener("keydown", keydown, true)
    binding.doc.getMap("paper").observeDeep(refresh)
  } catch (error) {
    editor._tiptapEditor.destroy()
    throw error
  }
  return {
    editor,
    setInline,
    toggle,
    resetInline() {
      assertActive()
      editor.removeStyles(
        Object.fromEntries(inlineKeys.map((key) => [key, ""]))
      )
    },
    unmount() {
      if (!active) return
      active = false
      binding.doc.getMap("paper").unobserveDeep(refresh)
      element.removeEventListener("keydown", keydown, true)
      mounted.delete(binding)
      editor._tiptapEditor.destroy()
    },
  }
}
