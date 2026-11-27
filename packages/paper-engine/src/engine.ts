import { closeHistory, history, redo, undo } from "prosemirror-history"
import {
  EditorState as PmState,
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
  type Selection,
  type SelectionCommand,
} from "@workspace/domain/paper-doc"

import type { CommandContext } from "./command-context.js"
import { applyCommand } from "./commands.js"
import { groupHistory, type HistoryGroup, type InputEdit } from "./history.js"
import { posIndex, toPm } from "./positions.js"
import { revert } from "./revert.js"
import { transactionSteps } from "./wire-steps.js"
import { fromDocument, invariantProblem, toDocument } from "./document-json.js"
import type { Ports } from "./ports.js"
import { applySelection, readSelection } from "./selection.js"
import { paperSchema } from "./schema.js"

export type EditorState = { readonly brand: "EditorState" }

type EditResult = { state: EditorState; change: Change }

export interface PaperEngine {
  load(doc: Document, version: number, client: string): EditorState
  run(
    state: EditorState,
    commands: readonly DocCommand[],
    origin: Origin,
    input?: InputEdit
  ): EditResult | { refusal: Refusal }
  undo(state: EditorState): EditResult | null
  redo(state: EditorState): EditResult | null
  revert: typeof revert
  select(state: EditorState, command: SelectionCommand): EditorState
  read(state: EditorState): {
    doc: Document
    selection: Selection
    version: number
  }
}

type Inner = {
  pm: PmState
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
    group: HistoryGroup | null
  ): EditResult {
    const change: Change = {
      edit: editIdSchema.parse(ports.ids()),
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

  return {
    load(doc, version, client) {
      const node = fromDocument(doc)
      const pm = PmState.create({
        schema: paperSchema,
        doc: node,
        selection: PmSelection.atStart(node),
        plugins: [history({ depth: Infinity })],
      })
      return wrap({ pm, version, client, actor: client, group: null })
    },

    run(state, commands, origin, input) {
      const inner = unwrap(state)
      const tr = inner.pm.tr
      const occupied = new Set(posIndex(tr.doc).blocks.keys())
      const newId = () => {
        let id = ports.ids()
        while (occupied.has(id)) id = ports.ids()
        occupied.add(id)
        return id
      }
      const ctx: CommandContext = { tr, newId, caret: null }
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
      return commit(inner, tr, origin, commands, group)
    },

    undo(state) {
      return runHistory(state, undo)
    },

    redo(state) {
      return runHistory(state, redo)
    },

    revert,

    select(state, command) {
      const inner = unwrap(state)
      const { doc, selection } = inner.pm
      const next = applySelection(doc, selection, command)
      if (!next || next.eq(selection)) return state
      return wrap({
        ...inner,
        pm: inner.pm.apply(closeHistory(inner.pm.tr.setSelection(next))),
        group: null,
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
