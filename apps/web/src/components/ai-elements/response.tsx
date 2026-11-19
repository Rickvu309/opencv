import { memo } from "react"

import { parseCoachMarkdown } from "@/features/coach/coach-markdown.ts"

import { ResponseBlock } from "./response-block.tsx"
import { ResponseWriting } from "./response-writing.ts"

const SettledBlock = memo(ResponseBlock)

export function Response({
  text,
  writing = false,
}: {
  text: string
  writing?: boolean
}) {
  if (!text) return null
  const blocks = parseCoachMarkdown(text)
  return (
    <ResponseWriting value={writing}>
      <div
        data-slot="response"
        className="min-w-0 space-y-2 [overflow-wrap:anywhere]"
      >
        {blocks.map((block, index) => (
          <SettledBlock key={index} source={JSON.stringify(block)} />
        ))}
      </div>
    </ResponseWriting>
  )
}
