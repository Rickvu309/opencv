import {
  useEffect,
  useEffectEvent,
  useId,
  useReducer,
  type ReactNode,
} from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
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
import { CoachDock, type DockRecentList } from "./coach-dock.tsx"
import { CoachHome } from "./coach-home.tsx"
import { CoachCapNotice } from "./coach-cap-notice.tsx"
import { ChatView } from "./chat-view.tsx"
import { CoachHistory } from "./coach-history.tsx"
import { CoachPanelHeader } from "./coach-panel-header.tsx"
import { CoachPageHeader } from "./coach-page-header.tsx"
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
  const composerId = useId()
  const store = useChatStore()
  const {
    activeChatId,
    navigationRevision,
    creationOwner,
    messages,
    phase,
    error,
    progress,
    chats,
    openChat,
  } = store
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
      draftNavigationRevision,
      addMenuOpened,
    },
    dispatch,
  ] = useReducer(workspaceReducer, undefined, () =>
    initialWorkspaceState(
      takeCoachDraft() ?? "",
      activeChatId,
      navigationRevision
    )
  )
  const profile = useQuery({ queryKey: profileKey(), queryFn: fetchProfile })
  const usage = useQuery({ queryKey: usageKey(), queryFn: fetchUsage })
  const papers = useQuery({
    queryKey: queryKey({ query: "paper.list" }),
    queryFn: coachPaperOptions,
    enabled: picker === "paper" || addMenuOpened,
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
  if (
    draftChatId !== activeChatId ||
    draftNavigationRevision !== navigationRevision
  ) {
    dispatch({
      type: "active_chat_changed",
      chatId: activeChatId,
      navigationRevision,
      createdHere: creationOwner === composerId,
      seeded: takeCoachDraft(),
    })
  }

  function send(text = draft) {
    if (!enabled || capped || active) return
    if (
      store.send(
        text,
        {
          context: attachments.map(({ kind, id }) => ({ kind, id })),
          attachments: attachments.map(({ kind, id, label }) => ({
            kind,
            id,
            label,
          })),
        },
        composerId
      )
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

  const recentPapers = [...(papers.data ?? [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2)
  const recent: DockRecentList = {
    state: papers.isError ? "error" : papers.data ? "ready" : "loading",
    items: recentPapers.map((doc) => ({
      id: doc.id,
      label: doc.name,
      kind: doc.kind,
      attached: attachments.some((a) => a.kind === "paper" && a.id === doc.id),
    })),
  }

  function selectRecent(id: string) {
    const doc = papers.data?.find((item) => item.id === id)
    if (!doc) return
    const held = attachments.find((a) => a.kind === "paper" && a.id === id)
    if (held) dispatch({ type: "attachment_removed", item: held })
    else attach({ kind: "paper", id, label: doc.name })
  }

  const compact = presentation === "compact"
  const showHome = messages.length === 0 && !active && !error
  const showWelcome = showHome && !compact
  const coachDock = (
    <CoachDock
      draft={draft}
      setDraft={(value) => dispatch({ type: "draft_typed", value })}
      onSend={() => send()}
      onStop={store.stop}
      turnActive={active}
      disabled={
        capped ||
        !enabled ||
        store.configuration === "loading" ||
        store.configuration === "error"
      }
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
      recent={recent}
      onRecentSelect={selectRecent}
      onAddMenuOpenChange={(open) => {
        if (open) dispatch({ type: "add_menu_opened" })
      }}
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
  const composer = (
    <div
      data-slot="coach-workspace-composer"
      className={cn(
        "space-y-2",
        !showWelcome && "mx-auto w-full max-w-2xl shrink-0",
        !showWelcome && (compact ? "px-2 pb-2" : "px-3 pt-2 pb-3")
      )}
    >
      {attachments.length ? (
        <div className="flex flex-wrap gap-1">
          {attachments.map((item) => (
            <Button
              key={`${item.kind}:${item.id}`}
              variant="secondary"
              size="xs"
              className="h-auto min-h-11 max-w-full min-w-0 text-left [overflow-wrap:anywhere] whitespace-normal md:min-h-0"
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
      ) : null}
      {usage.isError ? (
        <p role="status" className="text-xs text-muted-foreground">
          Could not load usage.{" "}
          <Button
            className="h-11 md:h-7"
            variant="link"
            size="sm"
            onClick={() => void usage.refetch()}
          >
            Retry
          </Button>
        </p>
      ) : null}
      {store.configuration === "loading" ? (
        <p role="status">Loading Coach settings…</p>
      ) : null}
      {store.configuration === "error" ? (
        <p role="alert" className="text-sm">
          {error}{" "}
          <Button
            variant="link"
            size="sm"
            className="h-11 md:h-8"
            onClick={() => store.retry()}
          >
            Retry
          </Button>
        </p>
      ) : null}
      {coachDock}
    </div>
  )
  const headerTitle = showHome
    ? "New chat"
    : (chats.find((chat) => chat.id === activeChatId)?.title ?? "New chat")

  const history = (
    <CoachHistory
      open={historyOpen}
      onOpenChange={(open) => dispatch({ type: "history_open_changed", open })}
      headerTitle={headerTitle}
      chats={chats}
      activeChatId={activeChatId}
      search={search}
      onSearchChange={(value) => dispatch({ type: "search_typed", value })}
      onSelect={(id) => {
        openChat(id)
      }}
      onNewChat={store.newChat}
      triggerClassName={compact ? undefined : "-ml-2"}
    />
  )

  return (
    <div
      data-slot="coach-panel-body"
      data-presentation={presentation}
      className="flex h-full min-h-0 flex-col"
    >
      {compact ? (
        <CoachPanelHeader
          history={history}
          showNewChat={!showHome}
          onNewChat={store.newChat}
        >
          {headerActions}
        </CoachPanelHeader>
      ) : (
        <CoachPageHeader
          history={history}
          showNewChat={!showHome}
          onNewChat={store.newChat}
        >
          {headerActions}
        </CoachPageHeader>
      )}
      <div
        className={cn(
          "min-h-0 flex-1",
          showWelcome ? "overflow-auto" : "flex flex-col overflow-hidden",
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
            {composer}
          </CoachHome>
        ) : (
          <ChatView
            messages={messages}
            waiting={phase === "waiting"}
            progress={progress}
            error={store.configuration === "error" ? null : error}
            onRetry={
              !capped && enabled && !store.limitReached
                ? store.retry
                : undefined
            }
            onRegenerate={
              !active && !capped && enabled ? store.regenerate : undefined
            }
            onUndo={!active ? store.undo : undefined}
          />
        )}
      </div>
      {!showWelcome ? composer : null}
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
              <Button className="h-11 md:h-8" onClick={attachLink}>
                Attach link
              </Button>
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
                    className="h-11 md:h-8"
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
                      className="h-auto min-h-11 w-full justify-start text-left whitespace-normal md:min-h-0"
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
                      className="h-auto min-h-11 w-full justify-start text-left whitespace-normal md:min-h-0"
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
