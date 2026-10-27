import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DEFAULT_TIME_ZONE, type CoachMode } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/components/sonner"
import { coachSendErrorMessage } from "@/features/home/coach-error.ts"
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
import { backAtPlaceholder, coachCopy, resetsAtLine } from "./coach-copy.ts"
import { useCoachPanelCovering } from "./coach-panel-presence.ts"
import { CoachComposer } from "./coach-composer.tsx"
import { CoachHistory } from "./coach-history.tsx"
import {
  attachApprovedResult,
  clearConfirm,
  decideConfirm,
  loadCoachChat,
  markUndone,
  readRestoredDraft,
  rememberFocus,
  sendCoachTurn,
  stopCoachTurn,
  subscribeCoachLive,
  takeRestoredDraft,
  useCoachLimited,
  useCoachLive,
} from "./coach-live.ts"
import {
  formatResetTime,
  isUuid,
  type CoachAttachment,
  type CoachListItem,
} from "./coach-model.ts"
import { CoachTranscript } from "./coach-transcript.tsx"
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
  const liveLimited = useCoachLimited()
  const pendingDraft = useSyncExternalStore(
    subscribeCoachLive,
    () => readRestoredDraft(chatId),
    () => readRestoredDraft(chatId)
  )
  const panelCovering = useCoachPanelCovering()
  // A 429 navigates to the new chat before the store write. The store
  // subscription fills the field. A local override keeps later edits.
  const [draftOverride, setDraftOverride] = useState<{
    id: string
    text: string
  } | null>(null)
  const draftId = chatId ?? ""
  const draft =
    draftOverride && draftOverride.id === draftId
      ? draftOverride.text
      : (pendingDraft ?? "")
  function setDraft(text: string) {
    setDraftOverride({ id: draftId, text })
  }
  const [attachments, setAttachments] = useState<CoachAttachment[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<CoachMode | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [localError, setLocalError] = useState<string | null>(null)
  const [hitLimit, setHitLimit] = useState(false)
  const decisions = useRef(new Set<string>())

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
  const capped =
    hitLimit ||
    liveLimited ||
    (usage?.day.capped === true && (usage.day.remaining ?? 1) <= 0)
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
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "n"
      ) {
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
      (item) =>
        (item.kind === "paper" || item.kind === "job") && isUuid(item.id)
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
    if (result.limited) setHitLimit(true)
    if (result.restoreDraft) setDraft(trimmed)
    else {
      setDraft("")
      setAttachments([])
      takeRestoredDraft(id)
    }
    void queryClient.invalidateQueries({ queryKey: ["coach", "usage"] })
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

  async function settle(
    pendingActionId: string,
    decision: "approved" | "denied"
  ) {
    if (!chatId || decisions.current.has(pendingActionId)) return
    decisions.current.add(pendingActionId)
    decideConfirm(chatId, pendingActionId, decision)
    try {
      if (decision === "approved") {
        const row = await approveAction(pendingActionId)
        attachApprovedResult(chatId, row)
      } else {
        await denyAction(pendingActionId)
      }
    } catch (error) {
      decisions.current.delete(pendingActionId)
      clearConfirm(chatId, pendingActionId)
      setLocalError(coachSendErrorMessage(error))
    }
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

  const glowEligible =
    !showFreeBanner && !streaming && draft.trim().length === 0
  let glowResultKey: string | null = null
  if (glowEligible) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (!message || message.role !== "coach") continue
      const partIndex = message.parts.findLastIndex(
        (part) => part.kind === "result"
      )
      if (partIndex >= 0) {
        glowResultKey = `${message.id}:${partIndex}`
        break
      }
    }
  }

  return (
    <div
      data-slot="coach-thread"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      {variant === "page" ? (
        <div className="order-1">
          <PageHeader title={empty ? coachCopy.howCanIHelp : title}>
            {live.focusKind === "paper" && live.focusId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onShare()}
              >
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
        </div>
      ) : null}
      {historyOpen ? null : (
        <div className="order-3">
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
              setAttachments((current) =>
                current.filter((item) => item.id !== id)
              )
            }
            onError={setLocalError}
          />
        </div>
      )}
      {historyOpen ? (
        <div className="order-2 flex min-h-0 flex-1 flex-col">
          <CoachHistory
            chats={chatsQuery.data ?? []}
            query={query}
            timeZone={timeZone}
            onQuery={setQuery}
            onOpen={openChat}
            onNew={() => void startNew()}
          />
        </div>
      ) : (
        <div className="order-2 flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
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
            <CoachTranscript
              messages={messages}
              streaming={streaming}
              now={now}
              glowResultKey={glowResultKey}
              onSettle={(pendingActionId, decision) =>
                void settle(pendingActionId, decision)
              }
              onOpen={(docId) =>
                void navigate({
                  href: docId ? `/app/paper/${docId}` : "/app/paper",
                })
              }
              onUndo={(activityId) => void onUndo(activityId)}
            />
          )}
          {showFreeBanner ? (
            <div
              role="status"
              className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-lg border border-border p-3"
            >
              <p className="text-sm font-medium">{coachCopy.limitHeading}</p>
              <p className="text-sm text-muted-foreground">
                {resetsAtLine(resetTime)}
              </p>
              <Button
                type="button"
                variant="glow"
                size="sm"
                className="self-start"
                onClick={() =>
                  void navigate({ href: "/app/settings/billing/upgrade" })
                }
              >
                {coachCopy.upgrade}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mx-auto w-full max-w-2xl text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
