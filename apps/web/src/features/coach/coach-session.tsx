import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DEFAULT_TIME_ZONE, type CoachMode } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/components/sonner"
import { ApiError } from "@/lib/api-error.ts"
import { CHAT_MESSAGE_MAX } from "@workspace/domain"

import {
  approveAction,
  createChat,
  denyAction,
  getCoachUsage,
  listChats,
  setChatFocus,
  sharePaper,
  undoActivity,
  updateCoachMode,
} from "./coach-api.ts"
import {
  backAtPlaceholder,
  coachCopy,
  resetsAtLine,
  workedLine,
  workingLine,
} from "./coach-copy.ts"
import { useCoachPanelCovering } from "./coach-panel-presence.ts"
import { CoachComposer } from "./coach-composer.tsx"
import { CoachHistory } from "./coach-history.tsx"
import {
  decideConfirm,
  loadCoachChat,
  markUndone,
  rememberFocus,
  sendCoachTurn,
  stopCoachTurn,
  useCoachLive,
} from "./coach-live.ts"
import {
  formatResetTime,
  isUuid,
  secondsBetween,
  type CoachAttachment,
  type CoachListItem,
} from "./coach-model.ts"
import { CoachResultCard } from "./coach-result-card.tsx"
import { COACH_MORE_IDEAS, COACH_STARTERS } from "./coach-starters.ts"

type Props = {
  chatId: string | null
  variant: "page" | "panel"
  onChatId?: (id: string) => void
}

function profileZone(profile: unknown) {
  if (!profile || typeof profile !== "object") return DEFAULT_TIME_ZONE
  const zone = (profile as { timeZone?: unknown }).timeZone
  return typeof zone === "string" && zone.trim() ? zone : DEFAULT_TIME_ZONE
}

export function CoachSession({ chatId, variant, onChatId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const live = useCoachLive(chatId)
  const panelCovering = useCoachPanelCovering()
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<CoachAttachment[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<CoachMode | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [localError, setLocalError] = useState<string | null>(null)

  const usageQuery = useQuery({
    queryKey: ["coach", "usage"],
    queryFn: getCoachUsage,
  })
  const chatsQuery = useQuery({
    queryKey: ["coach", "chats", query],
    queryFn: () => listChats(query),
    enabled: historyOpen,
  })
  const profileQuery = useQuery({
    queryKey: ["coach", "profile-zone"],
    queryFn: async () => {
      const { apiFetch } = await import("@/lib/api.ts")
      return apiFetch<unknown>("/api/profile")
    },
  })

  const usage = usageQuery.data ?? null
  const selectedMode = mode ?? usage?.mode ?? "free"
  const timeZone = profileZone(profileQuery.data)
  const capped = usage?.day.capped === true
  const resetTime = usage?.day.resetsAt
    ? formatResetTime(usage.day.resetsAt, timeZone)
    : ""
  const showFreeBanner = capped && (usage?.plan ?? "free") === "free"
  const streaming = chatId ? live.streaming : false
  const messages = chatId ? live.messages : []
  const error = localError ?? (chatId ? live.error : null)
  const empty = messages.length === 0 && !streaming
  const title = chatId && live.title.trim() ? live.title : coachCopy.newChat

  useEffect(() => {
    if (!chatId) return
    void loadCoachChat(chatId)
  }, [chatId])

  useEffect(() => {
    if (!streaming) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [streaming])

  useEffect(() => {
    if (variant !== "page") return
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "n") {
        return
      }
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return
        }
      }
      event.preventDefault()
      void startNew()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  async function startNew() {
    const created = await createChat()
    setDraft("")
    setAttachments([])
    setHistoryOpen(false)
    setLocalError(null)
    onChatId?.(created.id)
    void queryClient.invalidateQueries({ queryKey: ["coach", "chats"] })
    if (variant === "page") {
      void navigate({ href: `/app/coach/${created.id}` })
    }
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || capped || streaming) return
    if (trimmed.length > CHAT_MESSAGE_MAX) {
      setLocalError(coachCopy.tooLong)
      return
    }
    setLocalError(null)
    let id = chatId
    if (!id) {
      const created = await createChat()
      id = created.id
      onChatId?.(id)
      if (variant === "page") void navigate({ href: `/app/coach/${id}` })
    }
    const focus = attachments.find(
      (item) => (item.kind === "paper" || item.kind === "job") && isUuid(item.id)
    )
    if (focus && (focus.kind === "paper" || focus.kind === "job")) {
      await setChatFocus(id, focus.kind, focus.id).catch(() => undefined)
      rememberFocus(id, focus.kind, focus.id)
    }
    const result = await sendCoachTurn({
      chatId: id,
      text: trimmed,
      attachments,
    })
    if (result.restoreDraft) setDraft(trimmed)
    else {
      setDraft("")
      setAttachments([])
    }
    if (result.limited) {
      void queryClient.invalidateQueries({ queryKey: ["coach", "usage"] })
    }
    void queryClient.invalidateQueries({ queryKey: ["coach", "chats"] })
  }

  async function chooseMode(next: CoachMode) {
    if (next === selectedMode) return
    try {
      await updateCoachMode(next)
      setMode(next)
      void queryClient.invalidateQueries({ queryKey: ["coach", "usage"] })
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        void navigate({ href: "/app/settings/billing/upgrade" })
        return
      }
      setLocalError("The Coach couldn't switch modes. Try again.")
    }
  }

  async function onApprove(pendingActionId: string) {
    if (!chatId) return
    await approveAction(pendingActionId)
    decideConfirm(chatId, pendingActionId, "approved")
  }

  async function onDeny(pendingActionId: string) {
    if (!chatId) return
    await denyAction(pendingActionId)
    decideConfirm(chatId, pendingActionId, "denied")
  }

  async function onUndo(activityId: string) {
    if (!chatId) return
    await undoActivity(activityId)
    markUndone(chatId, activityId)
    toast(coachCopy.undone)
  }

  async function onShare() {
    if (!live.focusId) return
    try {
      const result = await sharePaper(live.focusId)
      if (result.url) await navigator.clipboard.writeText(result.url)
      toast(coachCopy.linkCopied)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : coachCopy.tooLong)
    }
  }

  function openChat(chat: CoachListItem) {
    setHistoryOpen(false)
    setQuery("")
    onChatId?.(chat.id)
    if (variant === "page") void navigate({ href: `/app/coach/${chat.id}` })
  }

  const placeholder = capped
    ? backAtPlaceholder(resetTime)
    : streaming
      ? coachCopy.workingPlaceholder
      : coachCopy.messageCoach

  if (variant === "page" && panelCovering) return null

  return (
    <div data-slot="coach-thread" className="flex h-full min-h-0 flex-col bg-background">
      {variant === "page" ? (
        <PageHeader title={empty ? coachCopy.howCanIHelp : title}>
          {live.focusKind === "paper" && live.focusId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void onShare()}>
              {coachCopy.share}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void startNew()}
          >
            {coachCopy.newChat}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {coachCopy.chatHistory}
          </Button>
        </PageHeader>
      ) : null}
      {historyOpen ? (
        <CoachHistory
          chats={chatsQuery.data ?? []}
          query={query}
          timeZone={timeZone}
          onQuery={setQuery}
          onOpen={openChat}
          onNew={() => void startNew()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          {empty ? (
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-8">
              {variant === "panel" ? (
                <h2 className="text-xl font-medium">{coachCopy.howCanIHelp}</h2>
              ) : null}
              <div className="flex flex-wrap justify-center gap-2">
                {COACH_STARTERS.map((starter) => (
                  <Button
                    key={starter}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft(starter)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void submit(starter)
                      }
                    }}
                  >
                    {starter}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={more}
                  onClick={() => setMore((open) => !open)}
                >
                  {coachCopy.moreIdeas}
                </Button>
                {more
                  ? COACH_MORE_IDEAS.map((starter) => (
                      <Button
                        key={starter}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraft(starter)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void submit(starter)
                          }
                        }}
                      >
                        {starter}
                      </Button>
                    ))
                  : null}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
              {messages.map((message) => (
                <div key={message.id} className="flex flex-col gap-2">
                  {message.role === "person" ? (
                    <p className="text-sm">{textOf(message)}</p>
                  ) : (
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
                      {streaming && message.id === messages.at(-1)?.id ? (
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
                            <div key={part.pendingActionId} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                              <p className="text-sm">{part.summary}</p>
                              {part.decided ? null : (
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => void onApprove(part.pendingActionId)}>
                                    {coachCopy.approve}
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => void onDeny(part.pendingActionId)}>
                                    {coachCopy.deny}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : null
                        )}
                      {message.parts
                        .filter((part) => part.kind === "result")
                        .map((part) =>
                          part.kind === "result" ? (
                            <CoachResultCard
                              key={part.activityId ?? part.name}
                              part={part}
                              glowOpen={!showFreeBanner}
                              onOpen={() =>
                                void navigate({
                                  href: part.docId ? `/app/paper/${part.docId}` : "/app/paper",
                                })
                              }
                              onUndo={() => {
                                if (part.activityId) void onUndo(part.activityId)
                              }}
                            />
                          ) : null
                        )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {showFreeBanner ? (
            <div role="status" className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{coachCopy.limitHeading}</p>
              <p className="text-sm text-muted-foreground">{resetsAtLine(resetTime)}</p>
              <p className="text-sm text-muted-foreground">{coachCopy.limitBody}</p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="self-start"
                onClick={() => void navigate({ href: "/app/settings/billing/upgrade" })}
              >
                {coachCopy.upgrade}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mx-auto w-full max-w-2xl text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}
      {historyOpen ? null : (
        <CoachComposer
          draft={draft}
          placeholder={placeholder}
          disabled={capped}
          streaming={streaming}
          mode={selectedMode}
          usage={usage}
          attachments={attachments}
          onDraft={setDraft}
          onSend={() => void submit(draft)}
          onStop={() => {
            if (chatId) stopCoachTurn(chatId)
          }}
          onMode={(next) => void chooseMode(next)}
          onAttach={(attachment) =>
            setAttachments((current) =>
              current.some((item) => item.id === attachment.id)
                ? current
                : [...current, attachment]
            )
          }
          onRemove={(id) =>
            setAttachments((current) => current.filter((item) => item.id !== id))
          }
          onError={setLocalError}
        />
      )}
    </div>
  )
}

function textOf(message: { parts: Array<{ kind: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.kind === "text" && part.text)
    .map((part) => part.text)
    .join("")
}
