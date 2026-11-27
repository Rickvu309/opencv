import { closeHistory, history, redo, undo } from "prosemirror-history"
import type { Node } from "prosemirror-model"
import {
  EditorState as PmState,
  type Plugin,
  Selection as PmSelection,
  TextSelection,
  type Transaction,
} from "prosemirror-state"
import {
  docCommandSchema,
  editIdSchema,
  type Change,
  type DocCommand,
  type Document,
  type Origin,
  type Refusal,
  type Run,
  type Selection,
  type SelectionCommand,
} from "@workspace/domain/paper-doc"

import type { CommandContext } from "./command-context.js"
import { applyCommand } from "./commands.js"
import { groupHistory, type HistoryGroup, type InputEdit } from "./history.js"
import { posIndex, toPm } from "./positions.js"
import { applySteps } from "./apply.js"
import { revert } from "./revert.js"
import { transactionSteps } from "./wire-steps.js"
import { Step } from "prosemirror-transform"
import {
  collabPlugin,
  confirmedDoc,
  pendingGroups,
  rebaseOnto,
  receiveChanges,
  sendableChanges,
  tagPending,
} from "./collab.js"
import { fromDocument, invariantProblem, toDocument } from "./document-json.js"
import type { Ports } from "./ports.js"
import { applySelection, readSelection } from "./selection.js"
import { paperSchema } from "./schema.js"

export type EditorState = { readonly brand: "EditorState" }

type EditResult = { state: EditorState; change: Change }
type Received = { state: EditorState; lost: Run[] }

export interface PaperEngine {
  load(
    doc: Document,
    version: number,
    client: string,
    pending?: readonly Change[]
  ): EditorState
  run(
    state: EditorState,
    commands: readonly DocCommand[],
    origin: Origin,
    input?: InputEdit
  ): EditResult | { refusal: Refusal }
  undo(state: EditorState): EditResult | null
  redo(state: EditorState): EditResult | null
  revert: typeof revert
  apply: typeof applySteps
  sendable(state: EditorState): Change[]
  receive(state: EditorState, changes: readonly Change[]): Received
  rebase(
    state: EditorState,
    doc: Document,
    version: number,
    landed: readonly string[]
  ): Received
  saved(state: EditorState): {
    doc: Document
    version: number
    pending: Change[]
  }
  select(state: EditorState, command: SelectionCommand): EditorState
  read(state: EditorState): {
    doc: Document
    selection: Selection
    version: number
  }
}

type Inner = {
  pm: PmState
  plugin: Plugin
  version: number
  client: string
  actor: string
  group: HistoryGroup | null
}

const inners = new WeakMap<EditorState, Inner>()

function wrap(inner: Inner): EditorState {
  const state = Object.freeze({}) as EditorState
  inners.set(state, inner)
  return state
}

function unwrap(state: EditorState): Inner {
  const inner = inners.get(state)
  if (!inner) throw new Error("This EditorState was not made by this engine")
  return inner
}

function caretSelection(doc: PmState["doc"], pm: number): PmSelection {
  const clamped = Math.max(0, Math.min(doc.content.size, pm))
  const $pos = doc.resolve(clamped)
  return $pos.parent.inlineContent
    ? TextSelection.create(doc, clamped)
    : PmSelection.near($pos)
}

export function createEngine(ports: Ports): PaperEngine {
  let historyToken = 0

  function commit(
    inner: Inner,
    tr: Transaction,
    origin: Origin,
    commands: readonly DocCommand[],
    group: HistoryGroup | null,
    edit = editIdSchema.parse(ports.ids())
  ): EditResult {
    tagPending(tr, { edit, origin, commands: [...commands] })
    const change: Change = {
      edit,
      origin,
      base: inner.version,
      ...transactionSteps(tr),
      commands: [...commands],
    }
    let pm = inner.pm.apply(tr)
    if (!group) pm = pm.apply(closeHistory(pm.tr))
    const actor =
      origin.kind === "person" && origin.client === inner.client
        ? origin.actor
        : inner.actor
    return { state: wrap({ ...inner, pm, actor, group }), change }
  }

  function runHistory(
    state: EditorState,
    command: typeof undo
  ): EditResult | null {
    const inner = unwrap(state)
    let result: EditResult | null = null
    command(inner.pm, (tr) => {
      if (invariantProblem(tr.doc)) return
      result = commit(
        inner,
        tr,
        {
          kind: "person",
          actor: inner.actor,
          client: inner.client,
        },
        [],
        null
      )
    })
    return result
  }

  function runInner(
    inner: Inner,
    commands: readonly DocCommand[],
    origin: Origin,
    input?: InputEdit,
    edit?: Change["edit"]
  ): EditResult | { refusal: Refusal } {
    const tr = inner.pm.tr
    const occupied = new Set(posIndex(tr.doc).blocks.keys())
    const newId = () => {
      let id = ports.ids()
      while (occupied.has(id)) id = ports.ids()
      occupied.add(id)
      return id
    }
    const ctx: CommandContext = { tr, newId, caret: null, keptMarks: null }
    for (const command of commands) {
      const parsed = docCommandSchema.safeParse(command)
      if (!parsed.success) {
        return {
          refusal: {
            code: "schema",
            detail: parsed.error.issues[0]!.message,
          },
        }
      }
      let refusal: Refusal | null
      ctx.keptMarks = null
      try {
        refusal = applyCommand(ctx, parsed.data)
      } catch (error) {
        refusal = {
          code: "schema",
          detail: error instanceof Error ? error.message : String(error),
        }
      }
      if (refusal) return { refusal }
    }
    const problem = invariantProblem(tr.doc)
    if (problem) return { refusal: { code: "schema", detail: problem } }
    const local =
      origin.client === inner.client &&
      (origin.kind === "person" || origin.proposal !== undefined)
    if (local && origin.kind === "person") {
      const caret = input?.caret ? toPm(tr.doc, input.caret) : ctx.caret
      if (caret !== null) tr.setSelection(caretSelection(tr.doc, caret))
      if (
        ctx.keptMarks &&
        tr.selection.empty &&
        tr.selection.head === ctx.caret
      )
        tr.setStoredMarks(ctx.keptMarks)
    }
    const group = groupHistory({
      tr,
      commands,
      input,
      previous: inner.group,
      local,
      person: origin.kind === "person" && origin.proposal === undefined,
      beforeCaret: inner.pm.selection.head,
      time: ports.now(),
      nextToken: () => ++historyToken,
    })
    return commit(inner, tr, origin, commands, group, edit)
  }

  function loaded(
    doc: Node,
    version: number,
    client: string,
    pending: readonly Change[]
  ): Inner {
    const plugin = collabPlugin(version, client)
    let pm = PmState.create({
      schema: paperSchema,
      doc,
      selection: PmSelection.atStart(doc),
      plugins: [history({ depth: Infinity }), plugin],
    })
    let base = version
    for (const change of pending) {
      if (change.base !== base)
        throw new Error(`Pending edit ${change.edit} is not at version ${base}`)
      const tr = pm.tr
      for (const json of change.steps) {
        const result = tr.maybeStep(Step.fromJSON(paperSchema, json))
        if (result.failed) throw new Error(result.failed)
      }
      const { edit, origin, commands } = change
      tagPending(tr, { edit, origin, commands }).setMeta("addToHistory", false)
      pm = pm.apply(tr)
      base += change.steps.length
    }
    return { pm, plugin, version, client, actor: client, group: null }
  }

  return {
    load(doc, version, client, pending = []) {
      return wrap(loaded(fromDocument(doc), version, client, pending))
    },

    sendable(state) {
      const { pm, plugin, version } = unwrap(state)
      return sendableChanges(pm, plugin, version)
    },

    saved(state) {
      const { pm, plugin, version } = unwrap(state)
      return {
        doc: toDocument(confirmedDoc(pm, plugin)),
        version,
        pending: sendableChanges(pm, plugin, version),
      }
    },

    receive(state, changes) {
      const inner = unwrap(state)
      const { tr, versions, lost } = receiveChanges(
        inner.pm,
        inner.plugin,
        changes
      )
      const problem = invariantProblem(tr.doc)
      if (problem)
        throw new Error(`Received changes break the Paper: ${problem}`)
      return {
        state: wrap({
          ...inner,
          pm: inner.pm.apply(tr),
          version: inner.version + versions,
          group: null,
        }),
        lost,
      }
    },

    rebase(state, doc, version, landed) {
      const inner = unwrap(state)
      let next: Inner = {
        ...loaded(fromDocument(doc), version, inner.client, []),
        actor: inner.actor,
      }
      const lost = rebaseOnto(
        pendingGroups(inner.pm, inner.plugin),
        inner.pm.doc,
        new Set(landed),
        ({ meta }) => {
          const result = runInner(
            next,
            meta.commands,
            meta.origin,
            undefined,
            meta.edit
          )
          if ("refusal" in result) return false
          next = unwrap(result.state)
          return true
        }
      )
      return { state: wrap(next), lost }
    },

    run(state, commands, origin, input) {
      return runInner(unwrap(state), commands, origin, input)
    },

    undo(state) {
      return runHistory(state, undo)
    },

    redo(state) {
      return runHistory(state, redo)
    },

    revert,

    apply: applySteps,

    select(state, command) {
      const inner = unwrap(state)
      const { doc, selection } = inner.pm
      const next = applySelection(doc, selection, command)
      if (!next || next.eq(selection)) return state
      const fromGroupCaret =
        inner.group !== null &&
        !next.empty &&
        next.anchor === inner.group.caret &&
        next.$anchor.sameParent(next.$head)
      const tr = inner.pm.tr.setSelection(next)
      return wrap({
        ...inner,
        pm: inner.pm.apply(fromGroupCaret ? tr : closeHistory(tr)),
        group: fromGroupCaret ? inner.group : null,
      })
    },

    read(state) {
      const { pm, version } = unwrap(state)
      return {
        doc: toDocument(pm.doc),
        selection: readSelection(pm.doc, pm.selection),
        version,
      }
    },
  }
}
