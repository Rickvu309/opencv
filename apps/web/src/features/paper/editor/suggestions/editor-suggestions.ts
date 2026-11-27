import type { DocCommand, Origin, Pos } from "@workspace/domain/paper-doc"
import {
  locate,
  type Layout,
  type Metrics,
  type PagePoint,
  type PaperEngine,
} from "@workspace/paper-engine"

import { createSuggestionLayer } from "./suggestion-layer.ts"
import { coachOrigin } from "./suggestion-view.ts"

type SuggestionEditor = {
  client: string
  metrics: Metrics
  layout(): Layout
  run(commands: DocCommand[], by: Origin): boolean
  focus(): void
  undo(): void
  refresh(): void
}

export function mountEditorSuggestions(
  host: HTMLElement,
  overlay: HTMLElement,
  engine: PaperEngine,
  editor: SuggestionEditor
) {
  const layer = createSuggestionLayer(host, overlay, engine, {
    land(commands, ids) {
      editor.focus()
      return editor.run(commands, coachOrigin(editor.client, ids))
    },
    undo: editor.undo,
    changed: editor.refresh,
  })

  function locateReal(point: PagePoint): Pos {
    const pos = locate(editor.metrics, editor.layout(), point)
    const owner = layer.owner(pos.block)
    return owner ? { block: owner, offset: 0 } : pos
  }

  return {
    stripHeight: layer.stripHeight,
    display: layer.display,
    draw: layer.draw,
    set: layer.set,
    destroy: layer.destroy,
    locateReal,
  }
}
