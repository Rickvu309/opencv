import type { ReactNode } from "react"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@workspace/ui/components/code-block"

import {
  type CoachInline,
  type CoachMarkdownBlock,
} from "@/features/coach/coach-markdown.ts"

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

export function ResponseBlock({ source }: { source: string }) {
  const block = JSON.parse(source) as CoachMarkdownBlock
  switch (block.type) {
    case "p":
      return <p>{renderInline(block.children)}</p>
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol className="list-decimal space-y-1 pl-5">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    case "pre":
      return (
        <CodeBlock size="sm">
          <CodeBlockActions>
            <CodeBlockCopyButton value={block.text} />
          </CodeBlockActions>
          <CodeBlockContent wrap>{block.text}</CodeBlockContent>
        </CodeBlock>
      )
  }
}
