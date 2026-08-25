import type { ReactNode } from "react"

import {
  parseCoachMarkdown,
  type CoachInline,
  type CoachMarkdownBlock,
} from "@/features/home/coach-markdown.ts"

function renderInline(nodes: CoachInline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <span key={index}>{node.text}</span>
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>
      case "code":
        return (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
          >
            {node.text}
          </code>
        )
    }
  })
}

function renderBlock(block: CoachMarkdownBlock, index: number) {
  switch (block.type) {
    case "p":
      return (
        <p key={index} className="text-sm leading-relaxed">
          {renderInline(block.children)}
        </p>
      )
    case "ul":
      return (
        <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol
          key={index}
          className="list-decimal space-y-1 pl-5 text-sm leading-relaxed"
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    case "pre":
      return (
        <pre
          key={index}
          className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed"
        >
          <code>{block.text}</code>
        </pre>
      )
  }
}

export function CoachMarkdown({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="space-y-2">{parseCoachMarkdown(text).map(renderBlock)}</div>
  )
}
