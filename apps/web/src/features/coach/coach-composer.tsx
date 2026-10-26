import { ArrowUp, Square } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

import { CoachAttachMenu } from "./coach-attach-menu.tsx"
import { coachCopy } from "./coach-copy.ts"
import { CoachModeMenu } from "./coach-mode-menu.tsx"
import type { CoachAttachment, CoachUsageView } from "./coach-model.ts"
import type { CoachMode } from "@workspace/domain"

type Props = {
  draft: string
  placeholder: string
  disabled: boolean
  streaming: boolean
  mode: CoachMode
  usage: CoachUsageView | null
  attachments: CoachAttachment[]
  onDraft: (value: string) => void
  onSend: () => void
  onStop: () => void
  onMode: (mode: CoachMode) => void
  onAttach: (attachment: CoachAttachment) => void
  onRemove: (id: string) => void
  onError: (message: string) => void
}

export function CoachComposer({
  draft,
  placeholder,
  disabled,
  streaming,
  mode,
  usage,
  attachments,
  onDraft,
  onSend,
  onStop,
  onMode,
  onAttach,
  onRemove,
  onError,
}: Props) {
  return (
    <div data-slot="coach-composer" className="flex flex-col gap-2 border-t border-border p-3">
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <Button
              key={`${attachment.kind}-${attachment.id}`}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRemove(attachment.id)}
            >
              {`Remove ${attachment.label}`}
            </Button>
          ))}
        </div>
      ) : null}
      <Textarea
        aria-label={coachCopy.messageCoach}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (!streaming) onSend()
          }
        }}
      />
      <div className="flex items-center gap-2">
        <CoachAttachMenu
          disabled={disabled}
          onAttach={onAttach}
          onError={onError}
        />
        <CoachModeMenu
          mode={mode}
          usage={usage}
          disabled={disabled}
          onMode={onMode}
        />
        <div className="flex-1" />
        <Button
          type="button"
          variant={
            !disabled && (streaming || draft.trim().length > 0)
              ? "default"
              : "outline"
          }
          size="icon-sm"
          aria-label={streaming ? coachCopy.stop : coachCopy.send}
          disabled={disabled}
          onClick={streaming ? onStop : onSend}
        >
          {streaming ? <Square /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  )
}
