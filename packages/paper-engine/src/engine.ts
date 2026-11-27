import {
  EditorState as PmState,
  Selection as PmSelection,
  TextSelection,
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

import { applyCommand, type CommandContext } from "./commands.js"
import { fromDocument, invariantProblem, toDocument } from "./document-json.js"
import type { Ports } from "./ports.js"
import { applySelection, readSelection } from "./selection.js"
import { paperSchema } from "./schema.js"

export type EditorState = { readonly brand: "EditorState" }

export interface PaperEngine {
  load(doc: Document, version: number, client: string): EditorState
  run(
    state: EditorState,
    commands: readonly DocCommand[],
    origin: Origin
  ): { state: EditorState; change: Change } | { refusal: Refusal }
  select(state: EditorState, command: SelectionCommand): EditorState
  read(state: EditorState): {
    doc: Document
    selection: Selection
    version: number
  }
}

type Inner = { pm: PmState; version: number; client: string }

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
  return {
    load(doc, version, client) {
      const node = fromDocument(doc)
      const pm = PmState.create({
        schema: paperSchema,
        doc: node,
        selection: PmSelection.atStart(node),
      })
      return wrap({ pm, version, client })
    },

    run(state, commands, origin) {
      const inner = unwrap(state)
      const tr = inner.pm.tr
      const ctx: CommandContext = { tr, newId: ports.ids, caret: null }
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
      if (origin.kind === "person" && ctx.caret !== null) {
        tr.setSelection(caretSelection(tr.doc, ctx.caret))
      }
      const change: Change = {
        edit: editIdSchema.parse(ports.ids()),
        origin,
        base: inner.version,
        steps: tr.steps.map((step) => step.toJSON()),
        inverse: tr.steps
          .map((step, index) => step.invert(tr.docs[index]!).toJSON())
          .reverse(),
        commands: [...commands],
      }
      return { state: wrap({ ...inner, pm: inner.pm.apply(tr) }), change }
    },

    select(state, command) {
      const inner = unwrap(state)
      const { doc, selection } = inner.pm
      const next = applySelection(doc, selection, command)
      if (!next) return state
      return wrap({
        ...inner,
        pm: inner.pm.apply(inner.pm.tr.setSelection(next)),
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
