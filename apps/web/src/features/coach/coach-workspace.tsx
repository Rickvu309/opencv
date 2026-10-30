import { useEffect, useEffectEvent, useReducer, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import { SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"

import {
  fetchProfile,
  fetchUsage,
  profileKey,
  usageKey,
} from "@/lib/account-api.ts"
import { coachPaperOptions, coachJobOptions } from "@/lib/coach-context.ts"
import { subscribeCoachDraft, takeCoachDraft } from "@/lib/coach-draft.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { CoachDock } from "./coach-dock.tsx"
import { CoachHome } from "./coach-home.tsx"
import { CoachCapNotice } from "./coach-cap-notice.tsx"
import { ChatView } from "./chat-view.tsx"
import { CoachHistory } from "./coach-history.tsx"
import { useChatStore } from "./use-chat-store.ts"
import {
  initialWorkspaceState,
  workspaceReducer,
} from "./coach-workspace.reducer.ts"
import type { Attachment } from "./coach-workspace.reducer.ts"

export function CoachWorkspace({
  chatId = null,
  primaryAction = false,
  presentation = "page",
  headerActions,
}: {
  chatId?: string | null
  primaryAction?: boolean
  presentation?: "page" | "compact"
  headerActions?: ReactNode
}) {
  const store = useChatStore()
  const { activeChatId, messages, phase, error, progress, chats, openChat } =
    store
  const [
    {
      draft,
      moreIdeas,
      historyOpen,
      search,
      picker,
      attachments,
      link,
      linkError,
      draftChatId,
    },
    dispatch,
  ] = useReducer(workspaceReducer, undefined, () =>
    initialWorkspaceState(takeCoachDraft() ?? "", activeChatId)
  )
  const profile = useQuery({ queryKey: profileKey(), queryFn: fetchProfile })
  const usage = useQuery({ queryKey: usageKey(), queryFn: fetchUsage })
  const papers = useQuery({
    queryKey: queryKey({ query: "paper.list" }),
    queryFn: coachPaperOptions,
    enabled: picker === "paper",
  })
  const jobs = useQuery({
    queryKey: queryKey({ query: "job.list" }),
    queryFn: coachJobOptions,
    enabled: picker === "job",
  })
  const active = phase !== "idle"
  const day = usage.data?.day
  const capped = day?.capped === true && day.remaining === 0
  const enabled = profile.data?.agentChat !== false
  const showUpgrade = usage.data?.plan === "free" && usage.data.mode === "free"
  const modeLabel =
    usage.data?.mode === "light"
      ? "Light"
      : usage.data?.mode === "max"
        ? "Max"
        : "Free"
  const resetTime = day
    ? new Date(day.resetsAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      })
    : "later"

  const openRequestedChat = useEffectEvent((id: string) => openChat(id))
  useEffect(() => {
    if (chatId) openRequestedChat(chatId)
  }, [chatId])
  useEffect(
    () =>
      subscribeCoachDraft((value) => dispatch({ type: "draft_typed", value })),
    []
  )
  if (draftChatId !== activeChatId) {
    dispatch({
      type: "active_chat_changed",
      chatId: activeChatId,
      seeded: takeCoachDraft(),
    })
  }

  function send(text = draft) {
    if (!enabled || capped || active) return
    if (
      store.send(text, {
        context: attachments.map(({ kind, id }) => ({ kind, id })),
        attachments: attachments.map(({ kind, id, label }) => ({
          kind,
          id,
          label,
        })),
      })
    )
      dispatch({ type: "draft_sent" })
  }

  function attach(item: Attachment) {
    dispatch({ type: "attached", item })
  }

  function attachLink() {
    try {
      const url = new URL(link)
      if (!["http:", "https:"].includes(url.protocol)) throw new Error()
      dispatch({
        type: "link_attached",
        item: { kind: "link", id: url.href, label: url.hostname },
      })
    } catch {
      dispatch({ type: "link_rejected" })
    }
  }

  const compact = presentation === "compact"
  const showHome = messages.length === 0 && !active
  const showWelcome = showHome && !compact
  const coachDock = (
    <CoachDock
      draft={draft}
      setDraft={(value) => dispatch({ type: "draft_typed", value })}
      onSend={() => send()}
      onStop={store.stop}
      turnActive={active}
      disabled={capped || !enabled}
      placeholder={
        capped
          ? `Coach is back at ${resetTime}`
          : compact
            ? "Reply…"
            : "Ask Coach anything"
      }
      menuPlacement={showWelcome ? "below" : "above"}
      onAttachFromPaper={() =>
        dispatch({ type: "picker_opened", picker: "paper" })
      }
      onAttachJob={() => dispatch({ type: "picker_opened", picker: "job" })}
      onAttachLink={() => dispatch({ type: "picker_opened", picker: "link" })}
      primaryAction={primaryAction}
      notice={
        capped ? (
          <CoachCapNotice
            modeLabel={modeLabel}
            resetTime={resetTime}
            showUpgrade={showUpgrade}
          />
        ) : undefined
      }
    />
  )
  const headerTitle = showHome
    ? "New chat"
    : (chats.find((chat) => chat.id === activeChatId)?.title ?? "New chat")

  return (
    <div
      data-slot="coach-panel-body"
      data-presentation={presentation}
      className="flex h-full min-h-0 flex-col"
    >
      <div
        data-slot={compact ? "coach-panel-header" : "coach-header"}
        data-home={showHome ? "" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border/50",
          compact ? "h-12 gap-[6px] ps-4 pe-2" : "h-11 justify-between px-3"
        )}
      >
        <h1 className="sr-only">Coach</h1>
        <CoachHistory
          open={historyOpen}
          onOpenChange={(open) =>
            dispatch({ type: "history_open_changed", open })
          }
          headerTitle={headerTitle}
          chats={chats}
          activeChatId={activeChatId}
          search={search}
          onSearchChange={(value) => dispatch({ type: "search_typed", value })}
          onSelect={(id) => {
            openChat(id)
          }}
          onNewChat={store.newChat}
        />
        {compact ? <span className="flex-1" /> : null}
        {!showHome ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            className="max-md:size-11"
            onClick={store.newChat}
          >
            <SquarePen className="size-4" />
          </Button>
        ) : null}
        {headerActions}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          compact && "px-[18px] py-2"
        )}
      >
        {showWelcome ? (
          <CoachHome
            moreIdeas={moreIdeas}
            onToggleIdeas={() => dispatch({ type: "more_ideas_toggled" })}
            onChooseStarter={(value) =>
              dispatch({ type: "draft_typed", value })
            }
            disabled={!enabled || capped}
          >
            {coachDock}
          </CoachHome>
        ) : (
          <ChatView
            messages={messages}
            waiting={phase === "waiting"}
            progress={progress}
            error={error}
            onRetry={!capped && enabled ? store.retry : undefined}
            onRegenerate={
              !active && !capped && enabled ? store.regenerate : undefined
            }
            onUndo={!active ? store.undo : undefined}
          />
        )}
      </div>
      <div
        data-slot="coach-workspace-composer"
        className={cn(
          "mx-auto w-full max-w-2xl shrink-0 space-y-2",
          compact ? "px-2 pb-2" : "px-3 pt-2 pb-3"
        )}
      >
        {attachments.length ? (
          <div className="flex flex-wrap gap-1">
            {attachments.map((item) => (
              <Button
                key={`${item.kind}:${item.id}`}
                variant="secondary"
                size="xs"
                className="h-auto max-w-full min-w-0 text-left [overflow-wrap:anywhere] whitespace-normal"
                onClick={() => dispatch({ type: "attachment_removed", item })}
                aria-label={`Remove ${item.label}`}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {item.label}
                </span>
                <span aria-hidden="true" className="shrink-0">
                  ×
                </span>
              </Button>
            ))}
          </div>
        ) : null}
        {!enabled ? (
          <p role="status" className="text-sm">
            Coach is turned off.{" "}
            <a href="/settings/coach" className="underline underline-offset-2">
              Open Settings
            </a>
          </p>
        ) : (!showHome || compact) && !capped && day?.capped ? (
          <p className="text-xs text-muted-foreground">
            {day.remaining} {usage.data?.mode} turns remaining today
          </p>
        ) : null}
        {usage.isError ? (
          <p role="status" className="text-xs text-muted-foreground">
            Could not load usage.{" "}
            <Button
              variant="link"
              size="sm"
              onClick={() => void usage.refetch()}
            >
              Retry
            </Button>
          </p>
        ) : null}
        {!showWelcome ? coachDock : null}
      </div>
      <Dialog
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "picker_closed" })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {picker === "paper"
                ? "Attach from Paper"
                : picker === "job"
                  ? "Attach from Apply"
                  : "Paste a link"}
            </DialogTitle>
            <DialogDescription>
              {picker === "link"
                ? "Coach can use this URL as a reference. Paste the relevant text in your message too."
                : "Choose context for your next message."}
            </DialogDescription>
          </DialogHeader>
          {picker === "link" ? (
            <>
              <Input
                aria-label="Link URL"
                placeholder="https://…"
                value={link}
                onChange={(event) =>
                  dispatch({ type: "link_typed", value: event.target.value })
                }
              />
              {linkError ? (
                <p role="alert" className="text-sm text-destructive">
                  {linkError}
                </p>
              ) : null}
              <Button onClick={attachLink}>Attach link</Button>
            </>
          ) : (
            <div className="max-h-96 space-y-1 overflow-auto">
              {(picker === "paper" && papers.isPending) ||
              (picker === "job" && jobs.isPending) ? (
                <p role="status">Loading…</p>
              ) : null}
              {(picker === "paper" && papers.isError) ||
              (picker === "job" && jobs.isError) ? (
                <p role="alert">
                  Could not load attachments.{" "}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void (picker === "paper"
                        ? papers.refetch()
                        : jobs.refetch())
                    }
                  >
                    Retry
                  </Button>
                </p>
              ) : null}
              {picker === "paper"
                ? papers.data?.map((doc) => (
                    <Button
                      key={doc.id}
                      variant="ghost"
                      className="h-auto w-full justify-start text-left whitespace-normal"
                      onClick={() =>
                        attach({ kind: "paper", id: doc.id, label: doc.name })
                      }
                    >
                      {doc.name}
                    </Button>
                  ))
                : jobs.data?.map((job) => (
                    <Button
                      key={job.id}
                      variant="ghost"
                      className="h-auto w-full justify-start text-left whitespace-normal"
                      onClick={() =>
                        attach({
                          kind: "job",
                          id: job.id,
                          label: `${job.title} at ${job.company}`,
                        })
                      }
                    >
                      {job.title} at {job.company}
                    </Button>
                  ))}
              {(
                picker === "paper"
                  ? papers.data?.length === 0
                  : jobs.data?.length === 0
              ) ? (
                <p className="text-sm text-muted-foreground">
                  Nothing to attach yet.
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
