import {
  blockIdSchema,
  type Block,
  type TemplateLine,
} from "@workspace/domain/paper-doc"

const KIND_OF_STYLE = {
  Title: "title",
  Heading1: "heading",
  ListBullet: "paragraph",
  Normal: "paragraph",
} as const

export function blocksFromLines(lines: readonly TemplateLine[]): Block[] {
  const blocks: Block[] = lines.map((line, index) => {
    const text = line.text.trim()
    return {
      type: "text_block",
      attrs: {
        id: blockIdSchema.parse(`line-${index + 1}`),
        kind: KIND_OF_STYLE[line.style],
        list: line.style === "ListBullet" ? "bullet" : null,
        level: 0,
        align: line.center ? "center" : "left",
        lineSpacing: null,
        keepWithNext: null,
      },
      ...(text ? { content: [{ type: "text", text }] } : {}),
    }
  })
  while (blocks.length && !("content" in blocks.at(-1)!)) blocks.pop()
  return blocks
}
