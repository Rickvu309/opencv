import { use, type ReactNode } from "react"

import { prefersReducedMotion } from "@workspace/ui/lib/motion"

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

import { ResponseWriting, writtenWords } from "./response-writing.ts"

function InlineText({ text }: { text: string }) {
  const writing = use(ResponseWriting)
  if (!writing || prefersReducedMotion()) return <span>{text}</span>
  return (
    <span>
      {writtenWords(text).map((word, index) => (
        <span key={index} className="motion-word">
          {word}
        </span>
      ))}
    </span>
  )
}

function renderInline(nodes: CoachInline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <InlineText key={index} text={node.text} />
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium [overflow-wrap:anywhere] text-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {renderInline(node.children)}
          </a>
        )
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
    case "heading":
      return block.level === 3 ? (
        <h4 className="pt-1 text-[0.9375rem] leading-6 font-semibold">
          {renderInline(block.children)}
        </h4>
      ) : (
        <h3 className="pt-2 text-[1.0625rem] leading-6 font-semibold tracking-[-0.01em]">
          {renderInline(block.children)}
        </h3>
      )
    case "table":
      return (
        <div
          role="region"
          aria-label="Table"
          tabIndex={0}
          data-slot="response-table"
          className="max-w-full overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <table className="w-full border-collapse text-left text-[0.875rem] leading-5">
            <thead className="bg-muted/50">
              <tr>
                {block.header.map((cell, column) => (
                  <th
                    key={column}
                    scope="col"
                    className="min-w-[7rem] border-b border-border px-3 py-2 align-bottom font-semibold [overflow-wrap:normal]"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border last:border-b-0"
                >
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      className="min-w-[7rem] px-3 py-2 align-top [overflow-wrap:normal]"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
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
