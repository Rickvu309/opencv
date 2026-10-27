import { Button } from "@workspace/ui/components/button"

import { coachCopy, workedLine, workingLine } from "./coach-copy.ts"
import { secondsBetween, type CoachUiMessage } from "./coach-model.ts"
import { CoachResultCard } from "./coach-result-card.tsx"

type Props = {
  messages: CoachUiMessage[]
  streaming: boolean
  now: number
  glowResultKey: string | null
  onSettle: (pendingActionId: string, decision: "approved" | "denied") => void
  onOpen: (docId: string | undefined) => void
  onUndo: (activityId: string) => void
}

export function CoachTranscript({
  messages,
  streaming,
  now,
  glowResultKey,
  onSettle,
  onOpen,
  onUndo,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col gap-2">
          {message.role === "person" ? (
            <p className="text-sm">{textOf(message)}</p>
          ) : (
            <CoachReply
              message={message}
              streaming={streaming}
              latest={message.id === messages.at(-1)?.id}
              now={now}
              glowResultKey={glowResultKey}
              onSettle={onSettle}
              onOpen={onOpen}
              onUndo={onUndo}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function CoachReply({
  message,
  streaming,
  latest,
  now,
  glowResultKey,
  onSettle,
  onOpen,
  onUndo,
}: {
  message: CoachUiMessage
  streaming: boolean
  latest: boolean
  now: number
  glowResultKey: string | null
  onSettle: Props["onSettle"]
  onOpen: Props["onOpen"]
  onUndo: Props["onUndo"]
}) {
  return (
    <>
      {message.parts
        .filter((part) => part.kind === "step")
        .map((part, index) => (
          <p
            key={`${message.id}-step-${index}`}
            role="status"
            className="coach-step text-sm text-muted-foreground"
          >
            {part.kind === "step" ? part.label : null}
          </p>
        ))}
      {message.parts.some((part) => part.kind === "text") ? (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          {message.parts
            .filter((part) => part.kind === "text")
            .map((part) => (part.kind === "text" ? part.text : ""))
            .join("")}
        </div>
      ) : null}
      {message.status === "aborted" ? (
        <p className="text-sm text-muted-foreground">{coachCopy.stopped}</p>
      ) : null}
      {streaming && latest ? (
        <p className="text-sm text-muted-foreground">
          {workingLine(secondsBetween(message.startedAt ?? now, now))}
        </p>
      ) : null}
      {!streaming && message.workedMs != null ? (
        <p className="text-sm text-muted-foreground">
          {workedLine(Math.max(1, Math.round(message.workedMs / 1000)))}
        </p>
      ) : null}
      {message.parts
        .filter((part) => part.kind === "confirm")
        .map((part) =>
          part.kind === "confirm" ? (
            <div
              key={part.pendingActionId}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <p className="text-sm">{part.summary}</p>
              {part.decided ? null : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSettle(part.pendingActionId, "approved")}
                  >
                    {coachCopy.approve}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSettle(part.pendingActionId, "denied")}
                  >
                    {coachCopy.deny}
                  </Button>
                </div>
              )}
            </div>
          ) : null
        )}
      {message.parts.map((part, index) =>
        part.kind === "result" ? (
          <CoachResultCard
            key={`${message.id}-result-${index}`}
            part={part}
            glowOpen={glowResultKey === `${message.id}:${index}`}
            onOpen={() => onOpen(part.docId)}
            onUndo={() => {
              if (part.activityId) onUndo(part.activityId)
            }}
          />
        ) : null
      )}
    </>
  )
}

function textOf(message: { parts: Array<{ kind: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.kind === "text" && part.text)
    .map((part) => part.text)
    .join("")
}
