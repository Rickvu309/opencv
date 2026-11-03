import { act, render } from "@testing-library/react"
import { TextSelection } from "prosemirror-state"
import { afterEach } from "vitest"
import type { PaperClient } from "@workspace/paper-crdt"

import {
  PaperEditorEngine,
  type LetterEditor,
  type PaperEditorHandle,
} from "@/features/paper/paper-editor-engine.tsx"

export function installEditorPolyfills() {
  ;(globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??=
    class extends Event {
      clipboardData = null
    }
  Element.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
}

export function openEngine(
  client: PaperClient,
  generation = 1,
  onSelectedBlocks: (ids: string[]) => void = () => undefined
) {
  const seen = {
    editor: null as LetterEditor | null,
    handle: null as PaperEditorHandle | null,
  }
  const element = (turn: number) => (
    <PaperEditorEngine
      kind="letter"
      client={client}
      generation={turn}
      label="Letter"
      onDocument={() => undefined}
      onSelectedBlocks={onSelectedBlocks}
      onReady={(editor) => {
        seen.editor = editor
      }}
      handleRef={(handle) => {
        seen.handle = handle
      }}
    />
  )
  const view = render(element(generation))
  return { seen, rerender: (turn: number) => view.rerender(element(turn)) }
}

let settleTimer: ReturnType<typeof setTimeout> | undefined

afterEach(() => clearTimeout(settleTimer))

export const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      settleTimer = setTimeout(resolve, 30)
    })
  })

export async function selectText(
  editor: LetterEditor,
  from: number,
  to: number
) {
  act(() => {
    editor.focus()
  })
  act(() => {
    editor.transact((tr) =>
      tr.setSelection(TextSelection.create(tr.doc, from, to))
    )
  })
  await settle()
}
