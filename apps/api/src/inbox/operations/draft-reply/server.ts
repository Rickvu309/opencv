import { operation } from "@workspace/domain/operations/inbox/draft-reply"
import type { OperationBinding } from "../../../registry/bind.js"
import { draftWithHint } from "../../draft-coach.js"
import { fixtureDraft } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor, registry) =>
    input.hint
      ? draftWithHint(registry, actor, input.threadId, input.hint)
      : fixtureDraft(actor, input.threadId),
  reversal: { irreversible: "A new draft replaces the one before it." },
  activity: { silent: "A draft is not sent, so it leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof fixtureDraft>>
>
