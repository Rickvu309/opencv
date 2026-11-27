import type { Node } from "prosemirror-model"
import { Step, type Transform } from "prosemirror-transform"
import { stepJsonSchema, type StepJSON } from "@workspace/domain/paper-doc"

function parts(step: Step): StepJSON[] {
  const json = step.toJSON()
  return json.stepType === "markSet"
    ? stepJsonSchema.array().parse(json.steps)
    : [stepJsonSchema.parse(json)]
}

export function transactionSteps(tr: Transform): {
  steps: StepJSON[]
  inverse: StepJSON[]
} {
  const steps: StepJSON[] = []
  const inverse: StepJSON[][] = []
  tr.steps.forEach((step, index) => {
    const before = tr.docs[index]!
    const json = step.toJSON()
    if (json.stepType !== "markSet") {
      steps.push(stepJsonSchema.parse(json))
      inverse.push(parts(step.invert(before)))
      return
    }

    const encoded = stepJsonSchema.array().parse(json.steps)
    steps.push(...encoded)
    let doc: Node = before
    for (const entry of encoded) {
      const part = Step.fromJSON(tr.doc.type.schema, entry)
      inverse.push(parts(part.invert(doc)))
      const result = part.apply(doc)
      if (!result.doc)
        throw new Error(result.failed ?? "Could not apply mark step")
      doc = result.doc
    }
  })
  return { steps, inverse: inverse.reverse().flat() }
}
