import type {
  AgentCommand,
  BlockId,
  DocCommand,
  Document,
} from "@workspace/domain/paper-doc"

function blockText(doc: Document, id: BlockId): string | null {
  const block = doc.content.find((each) => each.attrs.id === id)
  if (!block || block.type !== "text_block") return null
  return (block.content ?? [])
    .map((run) => (run.type === "text" ? run.text : ""))
    .join("")
}

function blocksMatch(doc: Document, blocks: BlockId[], expect: string[]) {
  return blocks.every((block, n) => blockText(doc, block) === expect[n])
}

function translate(doc: Document, command: AgentCommand): DocCommand[] | null {
  switch (command.op) {
    case "replaceText":
      return [
        command.text
          ? {
              op: "insertText",
              range: command.range,
              text: command.text,
              expect: command.expect,
            }
          : { op: "deleteRange", range: command.range, expect: command.expect },
      ]
    case "formatText": {
      const { from, to } = command.range
      const text = blockText(doc, from.block)
      if (from.block !== to.block || from.cell || to.cell) return null
      if (text?.slice(from.offset, to.offset) !== command.expect) return null
      return [
        {
          op: "setMark",
          range: command.range,
          mark: { type: command.mark },
          on: command.on,
        },
      ]
    }
    case "removeBlocks":
      return blocksMatch(doc, command.blocks, command.expect)
        ? command.blocks.map((block) => ({ op: "deleteBlock", block }))
        : null
    case "setBlockType":
      return blocksMatch(doc, command.blocks, command.expect)
        ? [{ op: "setBlockKind", blocks: command.blocks, kind: command.kind }]
        : null
    case "insertBlocks":
      return null
  }
}

export function pageCommands(
  doc: Document,
  commands: readonly AgentCommand[]
): DocCommand[] | null {
  const out: DocCommand[] = []
  for (const command of commands) {
    const each = translate(doc, command)
    if (!each) return null
    out.push(...each)
  }
  return out
}
