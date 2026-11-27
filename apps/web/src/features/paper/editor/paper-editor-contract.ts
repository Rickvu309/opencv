import type {
  DocCommand,
  Document,
  Pos,
  Range,
  Selection,
} from "@workspace/domain/paper-doc"
import type { EditorState, Layout, Metrics } from "@workspace/paper-engine"

import type { KeyAction } from "./input-port.ts"
import type { mountEditorSuggestions } from "./suggestions/editor-suggestions.ts"

export type PaperEditorOptions = {
  doc: Document
  metrics?: Metrics
  askLink?: (current: string) => string | null
  seat?: { state: EditorState; client: string; actor: string }
}

export type PaperEditor = {
  read(): { doc: Document; selection: Selection }
  range(): Range
  act(action: KeyAction): void
  apply(commands: DocCommand[]): boolean
  history(): { undo: boolean; redo: boolean }
  subscribe(listener: () => void): () => void
  layout(): Layout
  scale(): number
  focus(): void
  state(): EditorState
  adopt(state: EditorState): void
  caret(): Pos
  showPeers(carets: readonly Pos[]): void
  suggest: ReturnType<typeof mountEditorSuggestions>["set"]
  destroy(): void
}
