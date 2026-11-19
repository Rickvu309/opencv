import type { ReactNode } from "react"

import { CoachMarkdown } from "@/features/coach/coach-markdown.tsx"
import { DiffBlock } from "@/features/coach/rich-receipts.tsx"

import type { CoachPart, CoachToolPart } from "./coach-parts.ts"
import { CoachToolLine } from "./coach-tool-line.tsx"
import { useSmoothText } from "./use-smooth-text.ts"

export type PartContext = {
  canUndo: boolean
  onUndo?: (activityId: string) => Promise<void>
  streamingTextKey?: string
  undoNamesStep?: boolean
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
      undoLabel={ctx.undoNamesStep ? `Undo: ${part.label}` : undefined}
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
  const partCtx = {
    ...ctx,
    undoNamesStep: parts.filter((part) => part.kind === "tool").length > 1,
  }
  return parts.map((part) => (
    <div key={part.key}>{renderPart(part, partCtx)}</div>
  ))
}
