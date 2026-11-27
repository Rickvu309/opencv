import { Step, Transform } from "prosemirror-transform"
import type { Document, Refusal, StepJSON } from "@workspace/domain/paper-doc"

import { fromDocument, invariantProblem, toDocument } from "./document-json.js"
import { paperSchema } from "./schema.js"
import { transactionSteps } from "./wire-steps.js"

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function applySteps(
  doc: Document,
  steps: readonly StepJSON[]
): { doc: Document; inverse: StepJSON[] } | { refusal: Refusal } {
  let tr: Transform
  try {
    tr = new Transform(fromDocument(doc))
  } catch (error) {
    return { refusal: { code: "schema", detail: message(error) } }
  }
  for (const [index, json] of steps.entries()) {
    try {
      const result = tr.maybeStep(Step.fromJSON(paperSchema, json))
      if (result.failed)
        return {
          refusal: {
            code: "schema",
            detail: `Step ${index}: ${result.failed}`,
          },
        }
    } catch (error) {
      return {
        refusal: { code: "schema", detail: `Step ${index}: ${message(error)}` },
      }
    }
  }
  const problem = invariantProblem(tr.doc)
  if (problem) return { refusal: { code: "schema", detail: problem } }
  return { doc: toDocument(tr.doc), inverse: transactionSteps(tr).inverse }
}
