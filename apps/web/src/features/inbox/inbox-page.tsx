import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"

import { ApiError } from "@/lib/api.ts"
import { catalogClient, queryKey } from "@/lib/contract-client.ts"
import { PROFILE_ZONE } from "@/features/apply/apply-stages.ts"

import "./design/page-header.css"
import { InboxConnect, InboxTitleBar } from "./inbox-connect.tsx"
import {
  fetchGmailConnectTargetNotAContractRead,
  fetchInbox,
  fetchSnoozedInbox,
  fetchThread,
  inboxListKey,
  snoozedInboxKey,
} from "./inbox-api.ts"
import {
  InboxEmpty,
  InboxList,
  InboxListHeader,
  InboxListPane,
  InboxOverview,
} from "./inbox-list.tsx"
import {
  ACTION_FAILED,
  CompanyChip,
  EXAMPLE_MAIL_BANNER,
  GMAIL_UNAVAILABLE_COPY,
  GmailMark,
  INBOX_NOTICE,
  InboxSkeletonRows,
  VIEW_EXAMPLE_LABEL,
} from "./inbox-parts.tsx"
import { InboxReader } from "./inbox-reader.tsx"
import { INBOX_START, inboxReducer, type ScanProgress } from "./inbox-state.ts"
import { inboxConnectReadKeyOutsideContract } from "@/lib/requests.ts"

const NARROW = "(max-width: 767px)"

export function InboxPage() {
  const queryClient = useQueryClient()
  const narrow = useMediaQuery(NARROW, false)
  const now = new Date()
  const list = useQuery({
    queryKey: inboxListKey(),
    queryFn: fetchInbox,
  })
  const [{ openId, scanning, skipping, view }, dispatch] = useReducer(
    inboxReducer,
    INBOX_START
  )
  const holdTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(holdTimer.current), [])
  const snoozed = useQuery({
    queryKey: snoozedInboxKey(),
    queryFn: fetchSnoozedInbox,
    enabled: view === "snoozed",
  })
  const showConnect = Boolean(
    list.data && !list.data.connected && !list.data.skipped
  )
  const connect = useQuery({
    queryKey: inboxConnectReadKeyOutsideContract,
    queryFn: fetchGmailConnectTargetNotAContractRead,
    enabled: Boolean(
      list.data &&
      !list.data.connected &&
      (showConnect || list.data.threads.length === 0)
    ),
  })
  const threads =
    view === "snoozed"
      ? (snoozed.data?.threads ?? [])
      : (list.data?.threads ?? [])
  const zone = list.data?.timeZone || PROFILE_ZONE
  const shownId =
    openId && threads.some((thread) => thread.id === openId) ? openId : null
  const detail = useQuery({
    queryKey: queryKey({
      query: "inbox.get",
      input: { threadId: shownId ?? "" },
    }),
    queryFn: () => fetchThread(shownId ?? ""),
    enabled: Boolean(shownId) && scanning == null && !showConnect,
  })

  async function onSkip() {
    dispatch({ type: "skip_started" })
    try {
      await catalogClient.run(queryClient, "inbox.skip", {})
    } catch (error) {
      toast(messageOf(error))
    } finally {
      dispatch({ type: "skip_ended" })
    }
  }

  async function publishScan() {
    const result = await catalogClient.run(queryClient, "inbox.scan", {})
    if ("pending" in result) throw new Error("The scan is waiting")
    dispatch({
      type: "scan_found",
      progress: {
        emails: result.emailCount,
        companies: result.companyCount,
        names: result.threads.map((thread) => thread.company),
      },
    })
    await panelHold(holdTimer)
  }

  async function onScan() {
    dispatch({ type: "scan_started" })
    try {
      await publishScan()
    } catch (error) {
      toast(messageOf(error))
    } finally {
      dispatch({ type: "scan_ended" })
    }
  }

  async function onExplore() {
    dispatch({ type: "explore_started" })
    try {
      await catalogClient.run(queryClient, "inbox.skip", {})
      await publishScan()
      dispatch({ type: "scan_ended" })
    } catch (error) {
      toast(messageOf(error))
      dispatch({ type: "explore_failed" })
    }
  }

  const index = threads.findIndex((thread) => thread.id === shownId)

  const pending = list.isLoading || list.isError
  const titled = pending || (!scanning && showConnect)
  const exampleMail =
    list.data?.connected === false &&
    connect.isSuccess &&
    connect.data?.url == null
  const exampleNote = exampleMail ? GMAIL_UNAVAILABLE_COPY : undefined
  const scanLabel = exampleMail ? VIEW_EXAMPLE_LABEL : "Scan"

  return (
    <div
      data-surface="inbox"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden"
    >
      {titled ? <InboxTitleBar /> : null}
      {list.isLoading || (view === "snoozed" && snoozed.isLoading) ? (
        <InboxNotice>Loading inbox.</InboxNotice>
      ) : null}
      {list.isError ? (
        <InboxNotice tone="alert">
          <InboxRefresh
            text="Could not load inbox."
            onRefresh={() => void list.refetch()}
          />
        </InboxNotice>
      ) : null}
      {view === "snoozed" && snoozed.isError ? (
        <InboxNotice tone="alert">
          <InboxRefresh
            text="Could not load snoozed emails."
            onRefresh={() => void snoozed.refetch()}
          />
        </InboxNotice>
      ) : null}
      {scanning ? (
        <div className="flex min-h-0 min-w-0 flex-1">
          {narrow ? null : (
            <InboxListPane narrow={false}>
              <InboxListHeader
                scanning
                onScan={() => void onScan()}
                scanLabel={scanLabel}
                view={view}
                onViewChange={(next) =>
                  dispatch({ type: "view_changed", view: next })
                }
              />
              <InboxSkeletonRows />
            </InboxListPane>
          )}
          <Scanning
            progress={scanning}
            title={
              exampleMail ? "Loading example mail" : "Finding your job emails"
            }
          />
        </div>
      ) : null}
      {!scanning && showConnect ? (
        <InboxConnect
          url={connect.data?.url ?? null}
          pending={skipping || scanning != null}
          onSkip={() => void onSkip()}
          onExplore={() => void onExplore()}
        />
      ) : null}
      {!scanning &&
      view === "inbox" &&
      list.data &&
      !showConnect &&
      threads.length === 0 ? (
        <InboxEmpty
          scanning={false}
          onScan={() => void onScan()}
          view={view}
          onViewChange={(next) =>
            dispatch({ type: "view_changed", view: next })
          }
          note={exampleNote}
        />
      ) : null}
      {!scanning && (threads.length > 0 || view === "snoozed") ? (
        <div className="flex min-h-0 min-w-0 flex-1">
          {narrow && shownId ? null : (
            <InboxListPane narrow={narrow}>
              <InboxList
                threads={threads}
                openId={shownId}
                now={now}
                zone={zone}
                scanning={false}
                view={view}
                notice={
                  list.data?.connected === false && threads.length > 0
                    ? EXAMPLE_MAIL_BANNER
                    : undefined
                }
                scanLabel={scanLabel}
                onViewChange={(next) =>
                  dispatch({ type: "view_changed", view: next })
                }
                onOpen={(id) => dispatch({ type: "thread_opened", id })}
                onScan={() => void onScan()}
              />
            </InboxListPane>
          )}
          {!narrow && !shownId && view === "inbox" ? <InboxOverview /> : null}
          {shownId && detail.data ? (
            <InboxReader
              key={detail.data.id}
              detail={detail.data}
              index={index + 1}
              count={threads.length}
              narrow={narrow}
              now={now}
              zone={zone}
              onBack={() => dispatch({ type: "thread_closed" })}
              onReturnedToInbox={() =>
                dispatch({ type: "view_changed", view: "inbox" })
              }
              onPrevious={() => {
                const previous = threads[index - 1]
                if (previous)
                  dispatch({ type: "thread_opened", id: previous.id })
              }}
              onNext={() => {
                const next = threads[index + 1]
                if (next) dispatch({ type: "thread_opened", id: next.id })
              }}
            />
          ) : null}
          {shownId && (detail.isLoading || detail.isError) ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {detail.isLoading ? (
                <InboxNotice>Loading this email.</InboxNotice>
              ) : null}
              {detail.isError ? (
                <InboxNotice tone="alert">
                  <InboxRefresh
                    text="Could not load this email."
                    onRefresh={() => void detail.refetch()}
                  />
                </InboxNotice>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Scanning({
  progress,
  title,
}: {
  progress: ScanProgress
  title: string
}) {
  return (
    <section
      aria-label="Scanning"
      data-layout-section="Detail pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 pb-10"
    >
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card shadow-xs">
        <GmailMark className="h-3.75 w-5" />
      </span>
      <h2
        className="text-[15px] font-semibold text-foreground"
        data-user-content
      >
        {title}
      </h2>
      <div
        role="progressbar"
        aria-label="Scanning"
        className="h-1 w-65 max-w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-5/8 rounded-full bg-foreground motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
      {progress.emails != null && progress.companies != null ? (
        <p data-user-content className="text-xs text-muted-foreground">
          {`${progress.emails} emails from ${progress.companies} companies so far`}
        </p>
      ) : null}
      <ul className="flex flex-wrap justify-center gap-1.5 pt-1">
        {progress.names.map((name, chip) => (
          <CompanyChip key={`${name}-${chip}`} name={name} />
        ))}
      </ul>
    </section>
  )
}

function InboxNotice({
  children,
  tone = "status",
}: {
  children: ReactNode
  tone?: "status" | "alert"
}) {
  return (
    <div role={tone} className={`mx-5 my-4 ${INBOX_NOTICE}`}>
      {children}
    </div>
  )
}

function InboxRefresh({
  text,
  onRefresh,
}: {
  text: string
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p>{text}</p>
      <Button size="touch" variant="outline" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  )
}

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : ACTION_FAILED
}

function panelHold(timer: { current: number | undefined }) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--duration-panel")
    .trim()
  const parsed = Number.parseFloat(raw)
  const ms = Number.isFinite(parsed)
    ? raw.endsWith("s") && !raw.endsWith("ms")
      ? parsed * 1000
      : parsed
    : 280
  return new Promise((resolve) => {
    timer.current = window.setTimeout(resolve, ms)
  })
}
