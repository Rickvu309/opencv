import { Link } from "lucide-react"
import { paperIdSchema } from "@workspace/domain"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { useShareLink } from "./paper-share-link.ts"

export function PaperDocumentShare({ docId }: { docId: string }) {
  const parsed = paperIdSchema.safeParse(docId)
  return parsed.success ? <CopyLink docId={parsed.data} /> : null
}

function CopyLink({
  docId,
}: {
  docId: ReturnType<typeof paperIdSchema.parse>
}) {
  const share = useShareLink(docId)
  return (
    <CopyButton
      value={share}
      aria-label="Copy link"
      copiedMessage="Link copied"
      errorMessage="Could not copy the document link."
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 md:size-8"
    >
      <Link aria-hidden="true" />
    </CopyButton>
  )
}
