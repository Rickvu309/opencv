import type {
  AgentCommand,
  Change,
  DocCommand,
  Document,
  EditId,
  Origin,
  Refusal,
  Run,
} from "@workspace/domain/paper-doc"
import {
  textContainers,
  type EditorState,
  type PaperEngine,
} from "@workspace/paper-engine"

import type { AtVersion } from "../../log/index.js"

type Refused = { refusal: Refusal }
type Ran = { state: EditorState; changes: Change[] }

const unmappable: Refused = {
  refusal: { code: "unmappable", edit: "" as EditId },
}

function blockTexts(doc: Document) {
  return new Map(
    textContainers(doc)
      .filter((container) => !container.cell)
      .map((container) => [container.block as string, container.text])
  )
}

function checkBlocks(
  doc: Document,
  blocks: readonly string[],
  expect: readonly string[]
): Refused | null {
  const texts = blockTexts(doc)
  for (const [index, block] of blocks.entries()) {
    const found = texts.get(block)
    const at = { block: block as never, offset: 0 }
    if (found === undefined)
      return { refusal: { code: "no-such-position", at } }
    if (found !== expect[index])
      return { refusal: { code: "expect-mismatch", at, found } }
  }
  return null
}

function ran(
  engine: PaperEngine,
  from: Ran,
  commands: DocCommand[],
  origin: Origin
): Ran | Refused {
  const result = engine.run(from.state, commands, origin)
  if ("refusal" in result) return result
  return { state: result.state, changes: [...from.changes, result.change] }
}

function textOf(runs: readonly Run[] | undefined) {
  let text = ""
  const marks: DocCommand[] = []
  for (const run of runs ?? []) {
    if (run.type !== "text") continue
    for (const mark of run.marks ?? [])
      marks.push({
        op: "setMark",
        range: {
          from: { block: "" as never, offset: text.length },
          to: { block: "" as never, offset: text.length + run.text.length },
        },
        mark,
        on: true,
      })
    text += run.text
  }
  return { text, marks }
}

function inserted(
  engine: PaperEngine,
  start: Ran,
  command: Extract<AgentCommand, { op: "insertBlocks" }>,
  origin: Origin
): Ran | Refused {
  let current = start
  let previous: string = command.after
  for (const block of command.blocks) {
    const before = blockTexts(engine.read(current.state).doc)
    const split = ran(
      engine,
      current,
      [
        {
          op: "splitBlock",
          at: {
            block: previous as never,
            offset: before.get(previous)?.length ?? 0,
          },
        },
      ],
      origin
    )
    if ("refusal" in split) return split
    const doc = engine.read(split.state).doc
    const index = doc.content.findIndex((entry) => entry.attrs.id === previous)
    const made = doc.content[index + 1]?.attrs.id
    if (!made) return unmappable
    const { text, marks } = textOf(block.content)
    const at = { block: made, offset: 0 }
    const commands: DocCommand[] = [
      { op: "setBlockKind", blocks: [made], kind: block.kind },
      ...(text
        ? [{ op: "insertText" as const, range: { from: at, to: at }, text }]
        : []),
      ...marks.map((mark) =>
        mark.op === "setMark"
          ? {
              ...mark,
              range: {
                from: { block: made, offset: mark.range.from.offset },
                to: { block: made, offset: mark.range.to.offset },
              },
            }
          : mark
      ),
    ]
    const filled = ran(engine, split, commands, origin)
    if ("refusal" in filled) return filled
    current = filled
    previous = made
  }
  return current
}

function runOne(
  engine: PaperEngine,
  from: Ran,
  command: AgentCommand,
  origin: Origin
): Ran | Refused {
  const doc = engine.read(from.state).doc
  switch (command.op) {
    case "replaceText":
      return ran(
        engine,
        from,
        [
          command.text
            ? {
                op: "insertText",
                range: command.range,
                text: command.text,
                expect: command.expect,
              }
            : {
                op: "deleteRange",
                range: command.range,
                expect: command.expect,
              },
        ],
        origin
      )
    case "formatText": {
      const checked = engine.run(
        from.state,
        [
          {
            op: "insertText",
            range: command.range,
            text: command.expect,
            expect: command.expect,
          },
        ],
        origin
      )
      if ("refusal" in checked) return checked
      return ran(
        engine,
        from,
        [
          {
            op: "setMark",
            range: command.range,
            mark: { type: command.mark },
            on: command.on,
          },
        ],
        origin
      )
    }
    case "insertBlocks":
      return (
        checkBlocks(doc, [command.after], [command.expect]) ??
        inserted(engine, from, command, origin)
      )
    case "removeBlocks":
      return (
        checkBlocks(doc, command.blocks, command.expect) ??
        ran(
          engine,
          from,
          command.blocks.map((block) => ({ op: "deleteBlock", block })),
          origin
        )
      )
    case "setBlockType":
      return (
        checkBlocks(doc, command.blocks, command.expect) ??
        ran(
          engine,
          from,
          [{ op: "setBlockKind", blocks: command.blocks, kind: command.kind }],
          origin
        )
      )
  }
}

export function runAgentCommands(
  engine: PaperEngine,
  doc: Document,
  version: number,
  origin: Origin,
  commands: readonly AgentCommand[]
): Ran | Refused {
  let current: Ran = {
    state: engine.load(doc, version, origin.client),
    changes: [],
  }
  for (const command of commands) {
    const next = runOne(engine, current, command, origin)
    if ("refusal" in next) return next
    current = next
  }
  if (!current.changes.some((change) => change.steps.length))
    return {
      refusal: { code: "schema", detail: "These commands change nothing" },
    }
  return current
}

function addressed(doc: Document, commands: readonly AgentCommand[]) {
  const order = doc.content.map((block) => block.attrs.id as string)
  const ids = new Set<string>()
  for (const command of commands) {
    if (command.op === "replaceText" || command.op === "formatText") {
      const from = order.indexOf(command.range.from.block)
      const to = order.indexOf(command.range.to.block)
      for (const id of order.slice(Math.min(from, to), Math.max(from, to) + 1))
        ids.add(id)
      ids.add(command.range.from.block)
    } else if (command.op === "insertBlocks") ids.add(command.after)
    else for (const block of command.blocks) ids.add(block)
  }
  return ids
}

function touched(before: Document, after: Document) {
  const now = new Map(
    after.content.map((block) => [
      block.attrs.id as string,
      JSON.stringify(block),
    ])
  )
  return new Set(
    before.content
      .filter((block) => now.get(block.attrs.id) !== JSON.stringify(block))
      .map((block) => block.attrs.id as string)
  )
}

export function landAt(
  engine: PaperEngine,
  at: AtVersion,
  version: number,
  origin: Origin,
  commands: readonly AgentCommand[]
): Change | Refused {
  const changed = touched(at.doc, at.head)
  for (const id of addressed(at.doc, commands))
    if (changed.has(id)) return unmappable
  const preview = runAgentCommands(engine, at.doc, version, origin, commands)
  if ("refusal" in preview) return preview
  const steps = preview.changes.flatMap((change) => change.steps)
  const received = engine.receive(preview.state, at.later)
  const pending = engine.sendable(received.state)
  const mapped = pending.flatMap((change) => change.steps)
  const first = pending[0]
  if (!first || received.lost.length || mapped.length !== steps.length)
    return unmappable
  return {
    edit: first.edit,
    origin,
    base: first.base,
    steps: mapped,
    inverse: [],
    commands: pending.flatMap((change) => change.commands),
  }
}

export function changedBlocks(before: Document, after: Document) {
  const was = blockTexts(before)
  const now = blockTexts(after)
  const shapes = touched(before, after)
  for (const id of touched(after, before)) shapes.add(id)
  const runs = (text: string | undefined) => (text ? [{ text }] : [])
  return [...shapes]
    .filter((id) => was.has(id) || now.has(id))
    .slice(0, 30)
    .map((blockId) => ({
      blockId,
      before: runs(was.get(blockId)),
      after: runs(now.get(blockId)),
    }))
}
