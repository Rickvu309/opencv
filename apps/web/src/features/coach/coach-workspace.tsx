import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

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

import { profileQuery } from "@/lib/account-api.ts"
import { coachPaperOptions } from "@/lib/coach-context.ts"
import { subscribeCoachDraft, takeCoachDraft } from "@/lib/coach-draft.ts"
import { catalogClient, queryKey } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"
import { keepToastsClearOf } from "@/lib/toast-clearance.ts"
import { chatColumn } from "@/components/ai-elements/chat.tsx"
import { PromptInputFrame } from "@/components/ai-elements/prompt-input-frame.ts"
import { CoachDock, type DockRecentList } from "./coach-dock.tsx"
import { CoachHome } from "./coach-home.tsx"
import { CoachContextAttachments } from "./coach-context-attachments.tsx"
import { startComposerGlide } from "./coach-composer-glide.ts"
import { CoachCapNotice } from "./coach-cap-notice.tsx"
import { ChatView } from "./chat-view.tsx"
import { CoachHistory } from "./coach-history.tsx"
import { CoachPanelHeader } from "./coach-panel-header.tsx"
import { CoachPageHeader } from "./coach-page-header.tsx"
import { useChatStore } from "./use-chat-store.ts"
import {
  initialWorkspaceState,
  ATTACHMENT_LIMIT,
  pendingSentLine,
  workspaceReducer,
  type Attachment,
} from "./coach-workspace.reducer.ts"
import { linkAttachmentLabel } from "./coach-attachment-view.ts"
import { coachResetLabel } from "./coach-mode.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { coachViewportIsNarrow } from "./coach-composer-focus.ts"

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
  const composerBox = useRef<HTMLDivElement | null>(null)
  const glideFromTop = useRef<number | null>(null)
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
      historyOpen,
      search,
      picker,
      attachments,
      link,
      linkError,
      draftChatId,
      draftNavigationRevision,
      addMenuOpened,
      sent,
    },
    dispatch,
  ] = useReducer(workspaceReducer, undefined, () =>
    initialWorkspaceState(
      takeCoachDraft() ?? "",
      activeChatId,
      navigationRevision
    )
  )
  const profile = useQuery(profileQuery(useOwnerId()))
  const usage = catalogClient.useRead(useOwnerId(), "coach.usage", {})
  const papers = useQuery({
    queryKey: queryKey({ query: "paper.list" }),
    queryFn: coachPaperOptions,
    enabled: picker === "paper" || addMenuOpened,
  })
  const jobs = useQuery({
    ...catalogClient.options(useOwnerId(), "job.list", {}),
    enabled: picker === "job",
  })
  const awaitingApproval = messages.some((message) =>
    message.parts?.some(
      (part) =>
        part.type === "tool" &&
        (part.approval === "pending" ||
          Boolean(part.pendingActionId && !part.approval))
    )
  )
  const active = phase !== "idle"
  const chatSynced =
    draftChatId === activeChatId &&
    draftNavigationRevision === navigationRevision
  const retainUnstored = Boolean(error) && error !== "The Coach stopped."
  const sentBubble = chatSynced
    ? pendingSentLine(sent, {
        chatId: activeChatId,
        navigationRevision,
        messages,
        phase,
        retainUnstored,
      })
    : null
  if (chatSynced && sent && !sentBubble) {
    dispatch({ type: "sent_cleared" })
  }
  const day = usage.data?.day
  const capped = day?.capped === true && day.remaining === 0
  const enabled = profile.data?.agentChat !== false
  const modeLabel =
    usage.data?.mode === "light"
      ? "Light"
      : usage.data?.mode === "max"
        ? "Max"
        : "Free"
  const resetTime = day ? coachResetLabel(day.resetsAt, new Date()) : "later"
  const contextFull = attachments.length >= ATTACHMENT_LIMIT

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
    if (!enabled || capped || active || awaitingApproval) return
    const trimmed = text.trim()
    const sentAttachments = attachments.map(({ kind, id, label }) => ({
      kind,
      id,
      label,
    }))
    const seen = messages.filter(
      (message) => message.role === "user" && message.text === trimmed
    ).length
    const started = store.send(
      text,
      {
        context: sentAttachments.map(({ kind, id }) => ({ kind, id })),
        attachments: sentAttachments,
      },
      composerId
    )
    if (!started) return
    const box = composerBox.current
    glideFromTop.current = box?.closest('[data-slot="coach-home"]')
      ? box.getBoundingClientRect().top
      : null
    dispatch({
      type: "draft_sent",
      sent: {
        text: trimmed,
        seen,
        chatId: activeChatId,
        revision: navigationRevision,
        attachments: sentAttachments,
      },
    })
  }

  function chooseStarter(value: string) {
    dispatch({ type: "draft_typed", value })
    if (awaitingApproval || coachViewportIsNarrow()) return
    requestAnimationFrame(() => {
      const field = composerBox.current?.querySelector("textarea")
      if (!field || awaitingApproval || coachViewportIsNarrow()) return
      field.focus()
      field.setSelectionRange(field.value.length, field.value.length)
    })
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
        item: { kind: "link", id: url.href, label: linkAttachmentLabel(url) },
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

  const composerRef = useCallback(
    (element: HTMLDivElement | null) => {
      composerBox.current = element
      if (!element || showWelcome) return
      return keepToastsClearOf(element)
    },
    [showWelcome]
  )

  useLayoutEffect(() => {
    if (showWelcome) return
    const fromTop = glideFromTop.current
    glideFromTop.current = null
    const box = composerBox.current
    if (fromTop === null || !box) return
    startComposerGlide(
      box,
      fromTop,
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    )
  }, [showWelcome])
  const coachDock = (
    <CoachDock
      draft={draft}
      setDraft={(value) => dispatch({ type: "draft_typed", value })}
      onSend={() => send()}
      onStop={store.stop}
      turnActive={active && !awaitingApproval}
      holdReason={awaitingApproval ? "Approve or deny above" : undefined}
      disabled={
        capped ||
        !enabled ||
        store.configuration === "loading" ||
        store.configuration === "error"
      }
      placeholder={
        awaitingApproval
          ? "Approve or deny"
          : capped
            ? "Daily limit reached"
            : showHome
              ? "Ask Coach anything"
              : "Reply…"
      }
      menuPlacement={showWelcome ? "below" : "above"}
      onAttachFromPaper={() =>
        dispatch({ type: "picker_opened", picker: "paper" })
      }
      onAttachJob={() => dispatch({ type: "picker_opened", picker: "job" })}
      onAttachLink={() => dispatch({ type: "picker_opened", picker: "link" })}
      recent={recent}
      onRecentSelect={selectRecent}
      contextFull={contextFull}
      onAddMenuOpenChange={(open) => {
        if (open) dispatch({ type: "add_menu_opened" })
      }}
      primaryAction={primaryAction}
      notice={
        capped ? (
          <CoachCapNotice modeLabel={modeLabel} resetTime={resetTime} />
        ) : undefined
      }
    />
  )
  const composer = (
    <div
      ref={composerRef}
      data-slot="coach-workspace-composer"
      className={cn(
        "space-y-2",
        !showWelcome && "shrink-0",
        !showWelcome && !compact && cn(chatColumn, "pb-4"),
        !showWelcome &&
          compact &&
          "mx-auto w-full max-w-[736px] min-w-0 px-2 pb-2"
      )}
    >
      <CoachContextAttachments
        attachments={attachments}
        onRemove={(item) => dispatch({ type: "attachment_removed", item })}
      />
      {!enabled ? (
        <p role="status" className="text-sm text-muted-foreground">
          Coach is turned off.{" "}
          <Link
            to="/settings/{-$section}"
            params={{ section: "coach" }}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Open Settings
          </Link>
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
        <p role="status" className="text-sm text-muted-foreground">
          Loading Coach settings…
        </p>
      ) : null}
      {store.configuration === "error" ? (
        <p role="alert" className="text-sm text-destructive">
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
      <PromptInputFrame value={compact ? "panel" : "page"}>
        {coachDock}
      </PromptInputFrame>
    </div>
  )
  const headerTitle = showHome
    ? "Chats"
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
          showWelcome ? "overflow-auto" : "flex flex-col overflow-hidden"
        )}
      >
        {showWelcome ? (
          <CoachHome
            onChooseStarter={chooseStarter}
            disabled={!enabled || capped}
            recentChats={store.chatsLoaded ? chats : null}
            onOpenChat={openChat}
          >
            {composer}
          </CoachHome>
        ) : (
          <ChatView
            presentation={presentation}
            startedAt={
              chats.find((chat) => chat.id === activeChatId)?.createdAt ?? null
            }
            empty={
              compact && showHome ? (
                <CoachHome
                  size="panel"
                  onChooseStarter={chooseStarter}
                  disabled={!enabled || capped}
                />
              ) : null
            }
            messages={messages}
            pendingUser={
              sentBubble
                ? {
                    id: "pending-user",
                    role: "user",
                    text: sentBubble.text,
                    failed: retainUnstored && phase === "idle",
                    ...(sentBubble.attachments.length
                      ? { attachments: sentBubble.attachments }
                      : {}),
                  }
                : null
            }
            seenUserCount={sentBubble?.seen ?? 0}
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
                  : "Paste a job link"}
            </DialogTitle>
            <DialogDescription>
              {picker === "link"
                ? "Paste a job post or any page Coach should use. It is included with each message until you remove it. Paste the key text in your message too."
                : "What you add is included with each message until you remove it."}
            </DialogDescription>
          </DialogHeader>
          {picker === "link" ? (
            <form
              className="contents"
              onSubmit={(event) => {
                event.preventDefault()
                attachLink()
              }}
            >
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
              <Button size="touch" type="submit">
                Attach link
              </Button>
            </form>
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
                    size="touch"
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
                <div
                  data-slot="coach-picker-empty"
                  className="space-y-2 text-sm text-muted-foreground"
                >
                  <p>
                    {picker === "paper"
                      ? "You have no CVs or Letters in Paper yet. Create or import one in Paper, then add it here."
                      : "You have no Jobs in Apply yet. Add the Jobs you are applying for in Apply, then add one here."}
                  </p>
                  {picker === "paper" ? (
                    <Link
                      to={SURFACE_PATHS.paper}
                      className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 md:min-h-0"
                    >
                      Go to Paper
                    </Link>
                  ) : (
                    <Link
                      to={SURFACE_PATHS.apply}
                      className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 md:min-h-0"
                    >
                      Go to Apply
                    </Link>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
