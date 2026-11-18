import { Fragment } from "react"
import { visibleText } from "./canvas-draw.ts"
import type { WritingDraft } from "./canvas-edit.ts"

export function WritingBlocks({ blocks }: { blocks: WritingDraft["blocks"] }) {
  return blocks.map((block) => (
    <Fragment key={block.id}>
      <p data-block={block.id} contentEditable={block.held ? false : undefined}>
        {visibleText(block.text)}
      </p>
      {block.held && block.reason ? (
        <div className="text-xs text-muted-foreground">{block.reason}</div>
      ) : null}
    </Fragment>
  ))
}
