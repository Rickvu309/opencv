import type {
  DocCommand,
  Document,
  Range,
  Selection,
} from "@workspace/domain/paper-doc"
import type { Layout, Metrics } from "@workspace/paper-engine"

import type { KeyAction } from "./input-port.ts"

export type PaperEditorOptions = {
  doc: Document
  metrics?: Metrics
  askLink?: (current: string) => string | null
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
  destroy(): void
}
