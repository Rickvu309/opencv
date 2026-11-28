import { useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  richTextNodes,
  type RichPaperDocument,
} from "@workspace/domain/paper-doc"

import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { letterLines } from "./paper-letter-start.tsx"
import { stoppedLetter } from "./paper-letter-resume.ts"
import { LetterStoppedNotice } from "./paper-letter-stopped.tsx"

type RichDocumentSource = {
  document(): RichPaperDocument | null
  subscribe(listener: () => void): () => void
}

function textOf(source: RichDocumentSource | null) {
  const document = source?.document()
  if (!document) return null
  return richTextNodes(document)
    .map((node) => node.content.map((run) => run.text).join(""))
    .join("\n")
}

const noSubscription = () => () => {}

export function RichLetterStopped({
  docId,
  name,
  source,
  onOpen,
}: {
  docId: string
  name: string
  source: RichDocumentSource | null
  onOpen: (docId: string) => void
}) {
  const queryClient = useQueryClient()
  const email = authClient.useSession().data?.user.email
  const pageText = useSyncExternalStore(
    source ? (listener) => source.subscribe(listener) : noSubscription,
    () => textOf(source),
    () => null
  )
  async function replaceWithDraft(text: string) {
    const record = stoppedLetter()
    const lines = letterLines(text, email)
    const created = await catalogClient.run(queryClient, "paper.create", {
      kind: "letter",
      format: "rich",
      name,
      ...(record?.jobId ? { jobId: record.jobId } : {}),
      ...(lines.length > 0 ? { lines } : {}),
    })
    if ("pending" in created)
      throw new Error("Could not draft the letter. Try again.")
    await catalogClient.run(queryClient, "paper.delete", { docId })
    onOpen(created.id)
  }
  return (
    <div className="shrink-0 bg-surface-sunken px-4 md:px-6">
      <LetterStoppedNotice
        docId={docId}
        pageText={pageText}
        onWritten={replaceWithDraft}
      />
    </div>
  )
}
