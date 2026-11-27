import type {
  Change,
  DocCommand,
  Document,
  Origin,
  Run,
} from "@workspace/domain/paper-doc"

import {
  createEngine,
  fixedClock,
  seededIds,
  textContainers,
  type EditorState,
  type PaperEngine,
} from "./index.js"
import { globalOf, posAt } from "./model.test-support.js"

type Answer =
  | { kind: "ok" }
  | { kind: "stale"; since: Change[] }
  | { kind: "compacted"; doc: Document; version: number; landed: string[] }

type Reply = Answer & { base: number; sent: Change[] }

const tokenPattern = /\[[a-z]\d+\]/g

export const tokensOf = (text: string) => new Set(text.match(tokenPattern))
export const docText = (doc: Document) =>
  textContainers(doc)
    .map((container) => container.text.replaceAll("\n", ""))
    .join("")
export const runsText = (runs: readonly Run[]) =>
  runs.map((run) => (run.type === "text" ? run.text : "")).join("")

export class Server {
  private engine = createEngine({ ids: seededIds("srv"), now: fixedClock() })
  private state: EditorState
  private log: Change[] = []
  private floor = 0
  private ledger = new Set<string>()

  constructor(doc: Document) {
    this.state = this.engine.load(doc, 0, "srv")
  }

  get head() {
    return this.engine.read(this.state).version
  }

  doc() {
    return this.engine.read(this.state).doc
  }

  since(
    version: number,
    pending: readonly Change[]
  ): Answer & { kind: "stale" | "compacted" } {
    if (version < this.floor)
      return {
        kind: "compacted",
        doc: this.doc(),
        version: this.head,
        landed: pending
          .map((change) => change.edit)
          .filter((edit) => this.ledger.has(edit)),
      }
    const since = this.log.filter((change) => change.base >= version)
    if (since.length && since[0]!.base !== version)
      throw new Error(`Version ${version} falls inside a change`)
    return { kind: "stale", since }
  }

  push(base: number, sent: Change[]): Reply {
    if (base !== this.head) return { ...this.since(base, sent), base, sent }
    for (const change of sent) {
      if (this.ledger.has(change.edit))
        throw new Error(`Edit ${change.edit} stored twice`)
      this.ledger.add(change.edit)
    }
    const { state, lost } = this.engine.receive(this.state, sent)
    if (lost.length) throw new Error("The server lost text it accepted")
    this.state = state
    this.log.push(...sent)
    return { kind: "ok", base, sent }
  }

  compact() {
    this.floor = this.head
    this.log = []
  }
}

export class Tab {
  private engine: PaperEngine
  private generation = 0
  state: EditorState
  online = true
  inflight: { base: number; sent: Change[] } | null = null
  replies: Reply[] = []
  persisted: ReturnType<PaperEngine["saved"]>
  lost: Run[] = []
  typed: string[] = []
  deleted = new Set<string>()
  private origin: Origin

  constructor(
    readonly name: string,
    server: Server,
    private trace: string[]
  ) {
    this.origin = { kind: "person", actor: "p1", client: name }
    this.engine = this.freshEngine()
    this.state = this.engine.load(server.doc(), server.head, name)
    this.persisted = this.engine.saved(this.state)
  }

  private freshEngine() {
    this.generation += 1
    return createEngine({
      ids: seededIds(`${this.name}${this.generation}`),
      now: fixedClock(),
    })
  }

  private note(line: string) {
    this.trace.push(`${this.name}: ${line}`)
  }

  get doc() {
    return this.engine.read(this.state).doc
  }

  get version() {
    return this.engine.read(this.state).version
  }

  get pending() {
    return this.engine.sendable(this.state)
  }

  private persist() {
    this.persisted = this.engine.saved(this.state)
  }

  private take(lost: Run[], why: string) {
    if (!lost.length) return
    this.lost.push(...lost)
    this.note(`${why}, recovered "${runsText(lost)}"`)
  }

  edit(commands: DocCommand[], label: string) {
    const before = tokensOf(docText(this.doc))
    const result = this.engine.run(this.state, commands, this.origin)
    if ("refusal" in result) return
    this.state = result.state
    const after = tokensOf(docText(this.doc))
    for (const token of before) if (!after.has(token)) this.deleted.add(token)
    this.persist()
    this.note(`${label} -> "${docText(this.doc)}"`)
  }

  type(seed: number) {
    const token = `[${this.name}${this.typed.length + 1}]`
    const at = posAt(this.doc, seed)
    this.typed.push(token)
    this.edit(
      [{ op: "insertText", range: { from: at, to: at }, text: token }],
      `types ${token}`
    )
  }

  erase(seed: number, length: number) {
    const doc = this.doc
    const from = posAt(doc, seed)
    const to = posAt(doc, globalOf(doc, from) + (length % 6))
    const range =
      globalOf(doc, to) < globalOf(doc, from)
        ? { from: to, to: from }
        : { from, to }
    this.edit([{ op: "deleteRange", range }], "deletes a range")
  }

  split(seed: number) {
    this.edit(
      [{ op: "splitBlock", at: posAt(this.doc, seed) }],
      "presses Enter"
    )
  }

  dropBlock(seed: number) {
    const blocks = textContainers(this.doc)
    const block = blocks[seed % blocks.length]!.block
    this.edit([{ op: "deleteBlock", block }], `deletes block ${block}`)
  }

  push(server: Server) {
    if (!this.online || this.inflight) return
    const sent = this.pending
    if (!sent.length) return
    this.inflight = { base: this.version, sent }
    this.replies.push(server.push(this.version, sent))
    this.note(`sends ${sent.length} change(s) at version ${this.version}`)
  }

  deliver() {
    if (!this.online) return
    const reply = this.replies.shift()
    if (!reply) return
    this.inflight = null
    if (reply.base !== this.version) return
    this.answer(reply, reply.kind === "ok" ? reply.sent : [])
  }

  private answer(reply: Answer, sent: Change[]) {
    if (reply.kind === "ok") {
      this.state = this.engine.receive(this.state, sent).state
      this.note(`acknowledged at version ${this.version}`)
    } else if (reply.kind === "stale") {
      const { state, lost } = this.engine.receive(this.state, reply.since)
      this.state = state
      if (reply.since.length)
        this.note(
          `took ${reply.since.length} change(s), now version ${this.version}`
        )
      this.take(lost, "its pending text lost its place")
    } else {
      const { state, lost } = this.engine.rebase(
        this.state,
        reply.doc,
        reply.version,
        reply.landed
      )
      this.state = state
      this.note(`reloaded from compacted version ${reply.version}`)
      this.take(lost, "pending text could not prove its place")
    }
    this.persist()
  }

  pull(server: Server) {
    if (!this.online) return
    this.answer(server.since(this.version, this.pending), [])
  }

  loseReply() {
    if (this.replies.shift()) this.note("its acknowledgement was lost")
  }

  retry() {
    if (this.inflight && !this.replies.length) this.inflight = null
  }

  reload() {
    this.engine = this.freshEngine()
    const { doc, version, pending } = this.persisted
    this.state = this.engine.load(doc, version, this.name, pending)
    this.inflight = null
    this.replies = []
    this.note(`reloads with ${pending.length} pending change(s)`)
  }

  setOnline(online: boolean) {
    if (this.online !== online)
      this.note(online ? "goes online" : "goes offline")
    this.online = online
  }

  settle(server: Server) {
    this.setOnline(true)
    this.replies = []
    this.inflight = null
    this.pull(server)
    this.push(server)
    this.deliver()
    this.pull(server)
  }
}
