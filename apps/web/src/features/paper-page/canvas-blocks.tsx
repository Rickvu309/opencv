import { Fragment } from "react"
import { visibleText } from "./canvas-draw.ts"
import type { WritingDraft } from "./canvas-edit.ts"

export function WritingBlocks({
  blocks,
  placeholder,
}: {
  blocks: WritingDraft["blocks"]
  placeholder?: string
}) {
  const blank = blocks.length === 1 && blocks[0]?.text === ""
  return blocks.map((block) => (
    <Fragment key={block.id}>
      <p
        data-block={block.id}
        data-placeholder={blank ? placeholder : undefined}
        contentEditable={block.held ? false : undefined}
      >
        {visibleText(block.text)}
      </p>
      {block.held && block.reason ? (
        <div className="text-xs text-muted-foreground">{block.reason}</div>
      ) : null}
    </Fragment>
  ))
}
