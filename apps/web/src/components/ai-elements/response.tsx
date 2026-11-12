import { memo } from "react"

import { parseCoachMarkdown } from "@/features/coach/coach-markdown.ts"

import { ResponseBlock } from "./response-block.tsx"

const SettledBlock = memo(ResponseBlock)

export function Response({ text }: { text: string }) {
  if (!text) return null
  const blocks = parseCoachMarkdown(text)
  return (
    <div
      data-slot="response"
      className="min-w-0 space-y-2 [overflow-wrap:anywhere]"
    >
      {blocks.map((block, index) => {
        const source = JSON.stringify(block)
        return <SettledBlock key={`${index}:${source}`} source={source} />
      })}
    </div>
  )
}
