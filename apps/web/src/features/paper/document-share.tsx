import { Link } from "lucide-react"
import { paperIdSchema } from "@workspace/domain/kernel"
import { CopyButton } from "@workspace/ui/components/copy-button"

export function PaperDocumentShare({ docId }: { docId: string }) {
  if (!paperIdSchema.safeParse(docId).success) return null
  return (
    <CopyButton
      value={() => window.location.href}
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
