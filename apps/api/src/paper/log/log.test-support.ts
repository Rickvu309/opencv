import {
  paperEngineBlank,
  type Change,
  type DocCommand,
  type Origin,
} from "@workspace/domain/paper-doc"
import {
  createEngine,
  fixedClock,
  seededIds,
  type PaperEngine,
} from "@workspace/paper-engine"

export const serverEngine: PaperEngine = createEngine({
  ids: seededIds("server"),
  now: fixedClock(),
})

export const person: Origin = {
  kind: "person",
  actor: "user-1",
  client: "tab-1",
}

export const firstBlock = "paragraph-1"

export function writer(prefix = "edit") {
  const engine = createEngine({ ids: seededIds(prefix), now: fixedClock() })
  let state = engine.load(paperEngineBlank.blankCv(), 0, person.client)
  return {
    start: paperEngineBlank.blankCv(),
    run(commands: DocCommand[]): Change {
      const result = engine.run(state, commands, person)
      if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
      state = engine.receive(result.state, [result.change]).state
      return result.change
    },
    type(text: string, offset: number, block = firstBlock): Change {
      const pos = { block, offset } as never
      return this.run([
        { op: "insertText", range: { from: pos, to: pos }, text },
      ])
    },
    doc() {
      return engine.read(state).doc
    },
  }
}
