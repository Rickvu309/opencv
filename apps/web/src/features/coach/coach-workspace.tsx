import { useEffect, useEffectEvent, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { CoachContextItem } from "@workspace/domain"

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
import { queryKey } from "@/lib/contract-client.ts"
import { CoachDock } from "./coach-dock.tsx"
import { ChatView } from "./chat-view.tsx"
import { useChatStore } from "./use-chat-store.ts"

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

type Attachment = CoachContextItem & { label: string }
type Picker = "paper" | "job" | "link" | null

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

export function CoachWorkspace({ chatId = null }: { chatId?: string | null }) {
  const store = useChatStore()
  const { activeChatId, messages, phase, error, step, chats, openChat } = store
  const [draft, setDraft] = useState("")
  const [moreIdeas, setMoreIdeas] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [picker, setPicker] = useState<Picker>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [link, setLink] = useState("")
  const [linkError, setLinkError] = useState("")
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
  const [draftChatId, setDraftChatId] = useState(activeChatId)
  if (draftChatId !== activeChatId) {
    setDraftChatId(activeChatId)
    if (draftChatId !== null) {
      setDraft("")
      setAttachments([])
    }
  }

  function send(text = draft) {
    if (!enabled || capped || active) return
    if (
      store.send(text, {
        context: attachments.map(({ kind, id }) => ({ kind, id })),
      })
    )
      setDraft("")
  }

  function attach(item: Attachment) {
    setAttachments((current) =>
      current.some((a) => a.kind === item.kind && a.id === item.id)
        ? current
        : [...current, item].slice(0, 8)
    )
    setPicker(null)
  }

  function attachLink() {
    try {
      const url = new URL(link)
      if (!["http:", "https:"].includes(url.protocol)) throw new Error()
      attach({ kind: "link", id: url.href, label: url.hostname })
      setLink("")
      setLinkError("")
    } catch {
      setLinkError("Paste a full link.")
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
      setDraft={setDraft}
      onSend={() => send()}
      onStop={store.stop}
      turnActive={active}
      disabled={capped || !enabled}
      placeholder={
        capped ? `Coach is back at ${resetTime}` : "Ask Coach anything"
      }
      menuPlacement={showHome ? "below" : "above"}
      onAttachFromPaper={() => setPicker("paper")}
      onAttachJob={() => setPicker("job")}
      onAttachLink={() => setPicker("link")}
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
            onClick={() => setHistoryOpen(true)}
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
                onClick={() => setMoreIdeas((value) => !value)}
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
                      onClick={() => setDraft(starter)}
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
                onClick={() =>
                  setAttachments((current) => current.filter((a) => a !== item))
                }
                aria-label={`Remove ${item.label}`}
              >
                {item.label} ×
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
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
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
            onChange={(event) => setSearch(event.target.value)}
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
                        setHistoryOpen(false)
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
          if (!open) setPicker(null)
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
                onChange={(event) => setLink(event.target.value)}
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
