import type { ReactNode } from "react"

import {
  ToolCallCard,
  ToolCallGroup,
} from "@workspace/ui/components/tool-call-card"

import { CoachMarkdown } from "@/features/coach/coach-markdown.tsx"
import { DiffBlock } from "@/features/coach/rich-receipts.tsx"

import {
  groupAdjacentToolSteps,
  type CoachPart,
  type CoachToolPart,
} from "./coach-parts.ts"
import { toolCardProps } from "./coach-tool-card.ts"
import { CoachToolExtras, CoachToolLine } from "./coach-tool-line.tsx"
import { useSmoothText } from "./use-smooth-text.ts"

export type PartContext = {
  canUndo: boolean
  onUndo?: (activityId: string) => Promise<void>
  streamingTextKey?: string
}

type PartProps<K extends CoachPart["kind"]> = {
  part: Extract<CoachPart, { kind: K }>
  ctx: PartContext
}

function StreamingMarkdown({ text }: { text: string }) {
  return <CoachMarkdown text={useSmoothText(text)} writing />
}

function undoFor(tool: CoachToolPart, ctx: PartContext) {
  const { activityId } = tool.part
  const { onUndo } = ctx
  return activityId && onUndo ? () => onUndo(activityId) : undefined
}

// eslint-disable-next-line react-refresh/only-export-components -- the record is the module's contract
export const partRenderers: {
  [K in CoachPart["kind"]]: (props: PartProps<K>) => ReactNode
} = {
  text: ({ part, ctx }) =>
    part.key === ctx.streamingTextKey ? (
      <StreamingMarkdown text={part.markdown} />
    ) : (
      <CoachMarkdown text={part.markdown} />
    ),
  tool: ({ part, ctx }) => (
    <CoachToolLine
      tool={part}
      canUndo={ctx.canUndo}
      onUndo={undoFor(part, ctx)}
    />
  ),
  diff: ({ part }) => <DiffBlock detail={part.detail} />,
}

function renderPart(part: CoachPart, ctx: PartContext) {
  const render = partRenderers[part.kind] as (
    props: PartProps<CoachPart["kind"]>
  ) => ReactNode
  return render({ part, ctx })
}

export function CoachParts({
  parts,
  ctx,
}: {
  parts: readonly CoachPart[]
  ctx: PartContext
}) {
  return groupAdjacentToolSteps(parts).map((block) => {
    if (block.type === "part") {
      return <div key={block.part.key}>{renderPart(block.part, ctx)}</div>
    }
    const [first] = block.parts
    if (block.parts.length === 1 && first) {
      return <div key={first.key}>{renderPart(first, ctx)}</div>
    }
    return (
      <div key={block.parts[0]?.key} className="min-w-0 space-y-2">
        <ToolCallGroup>
          {block.parts.map((tool) => (
            <ToolCallCard key={tool.key} {...toolCardProps(tool)} />
          ))}
        </ToolCallGroup>
        {block.parts.map((tool) => (
          <CoachToolExtras
            key={tool.key}
            tool={tool}
            undoLabel={`Undo: ${tool.label}`}
            canUndo={ctx.canUndo}
            onUndo={undoFor(tool, ctx)}
          />
        ))}
      </div>
    )
  })
}
