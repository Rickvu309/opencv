import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { agentCommandSchema } from "../../../paper-doc/engine-command.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.suggestions",
  version: 1,
  kind: "read",
  description:
    "Read the open Coach Suggestions on one Paper: each pending paper.edit with commands, oldest first, for the page to show inline until the person accepts or rejects it.",
  label: "Read your Paper suggestions",
  readLabel: "Read your Paper suggestions",
  input: z.strictObject({ docId: z.uuid() }),
  publicResult: z.strictObject({
    suggestions: z.array(
      z.strictObject({
        id: z.uuid(),
        summary: z.string(),
        commands: z.array(agentCommandSchema),
      })
    ),
  }),
  coach: "never",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
