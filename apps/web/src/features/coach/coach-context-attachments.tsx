import { X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { attachmentView } from "./coach-attachment-view.ts"
import { ATTACHMENT_LIMIT, type Attachment } from "./coach-workspace.reducer.ts"

export function CoachContextAttachments({
  attachments,
  onRemove,
}: {
  attachments: Attachment[]
  onRemove: (item: Attachment) => void
}) {
  if (!attachments.length) return null
  const contextFull = attachments.length >= ATTACHMENT_LIMIT
  return (
    <div
      role="group"
      aria-label="Context in this Chat"
      data-slot="coach-context"
      className="space-y-1"
    >
      <ul className="flex flex-wrap gap-1">
        {attachments.map((item) => {
          const view = attachmentView(item)
          return (
            <li
              key={view.key}
              data-slot="coach-context-chip"
              data-kind={view.kind}
              className="flex max-w-full min-w-0 items-center rounded-md bg-secondary text-xs text-secondary-foreground"
            >
              {view.href ? (
                <a
                  href={view.href}
                  title={view.title}
                  {...(view.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex min-h-11 min-w-0 items-center truncate rounded-s-md ps-2.5 pe-1 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-7"
                >
                  <span className="truncate">{view.label}</span>
                </a>
              ) : (
                <span
                  title={view.title}
                  className="flex min-h-11 min-w-0 items-center ps-2.5 pe-1 md:min-h-7"
                >
                  <span className="truncate">{view.label}</span>
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-11 shrink-0 rounded-e-md text-muted-foreground hover:text-foreground md:size-7"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item.label}`}
              >
                <X className="size-3" />
              </Button>
            </li>
          )
        })}
      </ul>
      <p
        data-slot="coach-context-count"
        className="px-1 text-xs text-muted-foreground"
      >
        {contextFull
          ? `${attachments.length} of ${ATTACHMENT_LIMIT} added. Remove one to add another.`
          : `${attachments.length} of ${ATTACHMENT_LIMIT} · Included with each message until you remove them.`}
      </p>
    </div>
  )
}
