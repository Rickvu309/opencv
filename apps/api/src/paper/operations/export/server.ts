import { operation } from "@workspace/domain/operations/paper/export"
import type { OperationBinding } from "../../../registry/bind.js"
import { withRichSnapshot } from "../../content/content-store.js"

export const implementation = {
  operation,
  execute: (input, actor) =>
    withRichSnapshot(actor.userId, input, async (snapshot) => ({
      docId: snapshot.docId,
      kind: snapshot.kind,
      name: snapshot.name,
      basis: snapshot.basis,
    })),
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
