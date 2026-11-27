import { closeHistory } from "prosemirror-history"
import type { Transaction } from "prosemirror-state"
import type { DocCommand, Pos } from "@workspace/domain/paper-doc"

import { containerAt, toPm } from "./positions.js"

export type InputEdit =
  | { kind: "typing"; caret?: Pos }
  | { kind: "composition"; id: string; oneShot?: boolean; caret?: Pos }

export type HistoryGroup = {
  token: number
  composition: string | null
  time: number
  caret: number
}

const typingDelay = 500
const latinEnding = /[\p{Script=Latin}\p{M}\p{Nd}]$/u
const latinInput = /^(?:[\p{Script=Latin}\p{M}\p{Nd}\p{P}\p{Zs}])+$/u

export function groupHistory({
  tr,
  commands,
  input,
  previous,
  beforeCaret,
  local,
  person,
  time,
  nextToken,
}: {
  tr: Transaction
  commands: readonly DocCommand[]
  input: InputEdit | undefined
  previous: HistoryGroup | null
  beforeCaret: number
  local: boolean
  person: boolean
  time: number
  nextToken: () => number
}): HistoryGroup | null {
  if (!local) {
    closeHistory(tr).setMeta("addToHistory", false)
    return null
  }
  const command = commands.length === 1 ? commands[0] : undefined
  if (
    !person ||
    (command?.op !== "insertText" && command?.op !== "deleteRange")
  ) {
    closeHistory(tr)
    return null
  }
  if (!tr.docChanged) return previous

  const doc = tr.before
  const from = toPm(doc, command.range.from)!
  const to = toPm(doc, command.range.to)!
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const container = containerAt(doc, start)
  if (!container || container !== containerAt(doc, end)) {
    closeHistory(tr)
    return null
  }

  const typing =
    previous?.composition === null && time - previous.time <= typingDelay
  const latinComposition =
    input?.kind === "composition" &&
    input.oneShot &&
    command.op === "insertText" &&
    latinInput.test(command.text)
  const composition =
    input?.kind === "composition" && !latinComposition ? input.id : null
  const sameComposition =
    composition !== null && composition === previous?.composition
  const position = previous?.caret
  const adjacent = position === start || position === end
  const behindCaret = latinComposition && position === beforeCaret
  const sameTyping =
    composition === null &&
    typing &&
    (adjacent ||
      (behindCaret &&
        position !== undefined &&
        position > end &&
        container === containerAt(doc, position) &&
        latinEnding.test(doc.textBetween(container.start, position, "", "\n"))))

  if (!sameComposition && !sameTyping) closeHistory(tr)
  const group = {
    token: sameComposition || sameTyping ? previous!.token : nextToken(),
    composition,
    time,
    caret: tr.selection.head,
  }
  tr.setTime(Math.max(1, time)).setMeta("composition", group.token)
  return group
}
