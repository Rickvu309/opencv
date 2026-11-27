import type { Node } from "prosemirror-model"
import {
  AddMarkStep,
  AttrStep,
  DocAttrStep,
  Mapping,
  RemoveMarkStep,
  ReplaceAroundStep,
  ReplaceStep,
  Step,
  Transform,
} from "prosemirror-transform"
import type {
  Change,
  Document,
  Refusal,
  StepJSON,
} from "@workspace/domain/paper-doc"

import { fromDocument, invariantProblem } from "./document-json.js"
import { paperSchema } from "./schema.js"

function sameTarget(
  before: Node,
  after: Node,
  step: Step,
  mapped: Step
): boolean {
  if (step instanceof AttrStep && mapped instanceof AttrStep) {
    return (
      JSON.stringify(before.nodeAt(step.pos)?.attrs[step.attr]) ===
      JSON.stringify(after.nodeAt(mapped.pos)?.attrs[step.attr])
    )
  }
  if (step instanceof DocAttrStep) {
    return (
      JSON.stringify(before.attrs[step.attr]) ===
      JSON.stringify(after.attrs[step.attr])
    )
  }
  if (
    (step instanceof ReplaceStep ||
      step instanceof ReplaceAroundStep ||
      step instanceof AddMarkStep ||
      step instanceof RemoveMarkStep) &&
    (mapped instanceof ReplaceStep ||
      mapped instanceof ReplaceAroundStep ||
      mapped instanceof AddMarkStep ||
      mapped instanceof RemoveMarkStep)
  ) {
    return before
      .slice(step.from, step.to)
      .eq(after.slice(mapped.from, mapped.to))
  }
  return false
}

export function revert(
  doc: Document,
  change: Change,
  later: readonly Change[]
): { steps: StepJSON[] } | { refusal: Refusal } {
  const unmappable = {
    refusal: { code: "unmappable", edit: change.edit },
  } satisfies { refusal: Refusal }
  try {
    const current = fromDocument(doc)
    const tr = new Transform(current)
    const source = new Transform(current)
    for (const entry of [...later].reverse()) {
      for (const json of entry.inverse)
        source.step(Step.fromJSON(paperSchema, json))
    }

    let mapping = new Mapping()
    for (const entry of later) {
      for (const json of entry.steps)
        mapping.appendMap(Step.fromJSON(paperSchema, json).getMap())
    }

    for (const json of change.inverse) {
      const inverse = Step.fromJSON(paperSchema, json)
      const mapped = inverse.map(mapping)
      if (!mapped || !sameTarget(source.doc, tr.doc, inverse, mapped))
        return unmappable
      tr.step(mapped)
      source.step(inverse)
      const next = new Mapping()
      next.appendMap(inverse.getMap().invert())
      next.appendMapping(mapping)
      next.appendMap(mapped.getMap(), 0)
      mapping = next
    }
    return invariantProblem(tr.doc)
      ? unmappable
      : { steps: tr.steps.map((step) => step.toJSON()) }
  } catch {
    return unmappable
  }
}
