import { operation } from "@workspace/domain/operations/paper/import"
import { paperPackageMetadataSchema } from "@workspace/domain/paper-doc"
import type { OperationBinding } from "../../../registry/bind.js"
import { publishWordPackage } from "../../package-store.js"

export const implementation = {
  operation,
  privateResult: paperPackageMetadataSchema,
  execute: (input, actor) => publishWordPackage(actor.userId, input.stageId),
  reversal: () => ({
    irreversible: "A published Word document is not undone from import.",
  }),
  activity: (_input, output) => ({
    subjectKind: "paper",
    subjectId: output.docId,
    summary: `Imported ${output.name}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof publishWordPackage>>
>
