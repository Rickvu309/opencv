import { useEffect, useEffectEvent, useReducer } from "react"
import { useQuery } from "@tanstack/react-query"

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
import { ChatView } from "./chat-view.tsx"
import { useChatStore } from "./use-chat-store.ts"
import {
  initialWorkspaceState,
  workspaceReducer,
} from "./coach-workspace.reducer.ts"
import type { Attachment } from "./coach-workspace.reducer.ts"

const STARTERS = [
  "Review my CV",
  "Find roles",
  "Prep an interview",
  "Write a cover letter",
  "Plan my week",
  "Negotiate an offer",
  "Help me reply to a recruiter",
  "Turn my experience into stronger bullet points",
  "Help me compare two jobs",
  "Draft a follow-up after an interview",
  "Find gaps between my CV and a job",
]

const MORE_STARTERS = [
  "Follow up on an application",
  "Compare two offers",
  "Improve my LinkedIn",
  "Companies hiring now",
  "Set a weekly goal",
]

function historyGroup(date: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const timestamp = new Date(date).getTime()
  if (timestamp >= today.getTime()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (timestamp >= yesterday.getTime()) return "Yesterday"
  const week = new Date(today)
  week.setDate(week.getDate() - 7)
  return timestamp >= week.getTime() ? "Last 7 days" : "Earlier"
}

export function CoachWorkspace({
  chatId = null,
  primaryAction = false,
}: {
  chatId?: string | null
  primaryAction?: boolean
}) {
  const store = useChatStore()
  const { activeChatId, messages, phase, error, step, chats, openChat } = store
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
  const resetTime = day
    ? new Date(day.resetsAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
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

  const filtered = chats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  )
  const groups = ["Today", "Yesterday", "Last 7 days", "Earlier"]
  const showHome = messages.length === 0 && !active
  const coachDock = (
    <CoachDock
      draft={draft}
      setDraft={(value) => dispatch({ type: "draft_typed", value })}
      onSend={() => send()}
      onStop={store.stop}
      turnActive={active}
      disabled={capped || !enabled}
      placeholder={
        capped ? `Coach is back at ${resetTime}` : "Ask Coach anything"
      }
      menuPlacement={showHome ? "below" : "above"}
      onAttachFromPaper={() =>
        dispatch({ type: "picker_opened", picker: "paper" })
      }
      onAttachJob={() => dispatch({ type: "picker_opened", picker: "job" })}
      onAttachLink={() => dispatch({ type: "picker_opened", picker: "link" })}
      primaryAction={primaryAction}
    />
  )

  return (
    <div data-slot="coach-panel-body" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-sm font-medium">Coach</h1>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "history_opened" })}
          >
            History
          </Button>
          <Button variant="outline" size="sm" onClick={store.newChat}>
            New chat
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {showHome ? (
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center px-4 pt-60 pb-8 sm:px-6">
            <div className="flex w-full flex-col gap-3">
              <div className="pb-2 text-center">
                <h2 className="text-xl font-semibold">How can I help?</h2>
              </div>
              {coachDock}
              <Button
                variant="ghost"
                className="mx-auto h-10 rounded-full px-4"
                onClick={() => dispatch({ type: "more_ideas_toggled" })}
              >
                More ideas
              </Button>
              <div className="flex flex-wrap justify-center gap-2">
                {(moreIdeas ? MORE_STARTERS : STARTERS.slice(0, 6)).map(
                  (starter) => (
                    <Button
                      key={starter}
                      variant="outline"
                      className="h-10 rounded-full px-4 text-left whitespace-normal"
                      disabled={!enabled || capped}
                      onClick={() =>
                        dispatch({ type: "draft_typed", value: starter })
                      }
                    >
                      {starter}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          <ChatView
            messages={messages}
            waiting={phase === "waiting"}
            error={error}
            onRetry={store.retry}
            onRegenerate={!active ? store.regenerate : undefined}
            onUndo={!active ? store.undo : undefined}
          />
        )}
      </div>
      <div className="mx-auto w-full max-w-2xl shrink-0 space-y-2 px-3 pt-2 pb-3">
        {active && step ? (
          <p role="status" className="text-xs text-muted-foreground">
            {step.split("\n").map((label) => (
              <span key={label} className="block">
                {label}
              </span>
            ))}
          </p>
        ) : null}
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
        {capped ? (
          <p role="status" className="text-sm">
            You’ve reached today’s{" "}
            {usage.data?.mode === "free" ? "Free" : usage.data?.mode} limit.
            Coach is back at {resetTime}.{" "}
            <a
              href="/settings/billing/upgrade"
              className="underline underline-offset-2"
            >
              Upgrade
            </a>
          </p>
        ) : !enabled ? (
          <p role="status" className="text-sm">
            Coach is turned off.{" "}
            <a href="/settings/coach" className="underline underline-offset-2">
              Open Settings
            </a>
          </p>
        ) : day?.capped ? (
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
        {!showHome ? coachDock : null}
      </div>
      <Dialog
        open={historyOpen}
        onOpenChange={(open) =>
          dispatch({ type: "history_open_changed", open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat history</DialogTitle>
            <DialogDescription>
              Search and reopen a conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Search chat history"
            placeholder="Search chats"
            value={search}
            onChange={(event) =>
              dispatch({ type: "search_typed", value: event.target.value })
            }
          />
          <div className="max-h-96 space-y-4 overflow-auto">
            {groups.map((group) => {
              const items = filtered.filter(
                (chat) => historyGroup(chat.updatedAt) === group
              )
              return items.length ? (
                <section key={group} className="space-y-1">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {group}
                  </h3>
                  {items.map((chat) => (
                    <Button
                      key={chat.id}
                      variant="ghost"
                      className="h-auto w-full justify-start text-left whitespace-normal"
                      onClick={() => {
                        openChat(chat.id)
                        dispatch({ type: "history_open_changed", open: false })
                      }}
                    >
                      {chat.title}
                    </Button>
                  ))}
                </section>
              ) : null
            })}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chats found.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
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
