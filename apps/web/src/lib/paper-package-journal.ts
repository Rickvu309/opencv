export class JournalRefusal extends Error {
  readonly code: "empty-command" | "empty-draft" | "same-command"

  constructor(code: "empty-command" | "empty-draft" | "same-command") {
    super(code)
    this.name = "JournalRefusal"
    this.code = code
  }
}

export type CoalescedWrite = {
  readonly commandId: string
  readonly generation: number
  readonly words: string
}

export type PackageJournal = CoalescedWrite

function commandOf(value: string) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value)
    throw new JournalRefusal("empty-command")
  return value
}

function wordsOf(value: string) {
  if (typeof value !== "string") throw new JournalRefusal("empty-draft")
  return value
}

function freeze(write: CoalescedWrite): PackageJournal {
  return Object.freeze({
    commandId: write.commandId,
    generation: write.generation,
    words: write.words,
  })
}

export function openJournal(commandId: string, words: string): PackageJournal {
  return freeze({
    commandId: commandOf(commandId),
    generation: 1,
    words: wordsOf(words),
  })
}

export function typeInto(
  journal: PackageJournal,
  words: string
): PackageJournal {
  const next = wordsOf(words)
  if (next === journal.words) return journal
  return freeze({
    commandId: journal.commandId,
    generation: journal.generation + 1,
    words: next,
  })
}

export function coalescedWrite(journal: PackageJournal): CoalescedWrite {
  return freeze(journal)
}

export function nextCommand(
  journal: PackageJournal,
  commandId: string
): PackageJournal {
  const command = commandOf(commandId)
  if (command === journal.commandId) throw new JournalRefusal("same-command")
  return freeze({
    commandId: command,
    generation: journal.generation,
    words: journal.words,
  })
}
