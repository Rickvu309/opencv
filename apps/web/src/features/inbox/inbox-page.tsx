import { useReducer } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/sonner"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"

import { ApiError } from "@/lib/api.ts"
import { queryKey, useRunCommand } from "@/lib/contract-client.ts"
import { PROFILE_ZONE } from "@/features/apply/apply-stages.ts"

import "./design/page-header.pen.css"
import { InboxConnect, InboxTitleBar } from "./inbox-connect.tsx"
import {
  fetchConnect,
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
import { CompanyChip, GmailMark, InboxSkeletonRows } from "./inbox-parts.tsx"
import { InboxReader } from "./inbox-reader.tsx"
import { inboxConnectKey } from "@/lib/requests.ts"

const NARROW = "(max-width: 767px)"

type InboxState = {
  openId: string | null
  view: "inbox" | "snoozed"
  scanning: ScanProgress | null
  skipping: boolean
}

type InboxAction =
  | { type: "view_changed"; view: "inbox" | "snoozed" }
  | { type: "thread_opened"; id: string }
  | { type: "thread_closed" }
  | { type: "skip_started" }
  | { type: "skip_ended" }
  | { type: "scan_started" }
  | { type: "scan_found"; progress: ScanProgress }
  | { type: "scan_ended" }

const INBOX_START: InboxState = {
  openId: null,
  view: "inbox",
  scanning: null,
  skipping: false,
}

function inboxReducer(state: InboxState, action: InboxAction): InboxState {
  switch (action.type) {
    case "view_changed":
      return { ...state, view: action.view, openId: null }
    case "thread_opened":
      return { ...state, openId: action.id }
    case "thread_closed":
      return { ...state, openId: null }
    case "skip_started":
      return { ...state, skipping: true }
    case "skip_ended":
      return { ...state, skipping: false }
    case "scan_started":
      return {
        ...state,
        scanning: { emails: null, companies: null, names: [] },
      }
    case "scan_found":
      return { ...state, scanning: action.progress }
    case "scan_ended":
      return { ...state, scanning: null }
  }
}

export function InboxPage() {
  const runCommand = useRunCommand()
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
  const snoozed = useQuery({
    queryKey: snoozedInboxKey(),
    queryFn: fetchSnoozedInbox,
    enabled: view === "snoozed",
  })
  const showConnect = Boolean(
    list.data && !list.data.connected && !list.data.skipped
  )
  const connect = useQuery({
    queryKey: inboxConnectKey,
    queryFn: fetchConnect,
    enabled: showConnect,
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
      await runCommand("inbox.skip", {})
    } catch (error) {
      toast(messageOf(error))
    } finally {
      dispatch({ type: "skip_ended" })
    }
  }

  async function onScan() {
    dispatch({ type: "scan_started" })
    try {
      const result = await runCommand("inbox.scan", {})
      dispatch({
        type: "scan_found",
        progress: {
          emails: result.emailCount,
          companies: result.companyCount,
          names: result.threads.map((thread) => thread.company),
        },
      })
      await panelHold()
    } catch (error) {
      toast(messageOf(error))
    } finally {
      dispatch({ type: "scan_ended" })
    }
  }

  const index = threads.findIndex((thread) => thread.id === shownId)

  const pending = list.isLoading || list.isError
  const titled =
    pending ||
    (!scanning && showConnect) ||
    (!scanning && Boolean(list.data) && !showConnect && threads.length === 0)

  return (
    <div
      data-pen-surface="inbox"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden"
    >
      {titled ? <InboxTitleBar /> : null}
      {list.isLoading || (view === "snoozed" && snoozed.isLoading) ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Loading inbox.
        </p>
      ) : null}
      {list.isError ? (
        <p role="alert" className="px-5 py-6 text-sm">
          Could not load inbox. Refresh the page.
        </p>
      ) : null}
      {view === "snoozed" && snoozed.isError ? (
        <p role="alert" className="px-5 py-6 text-sm">
          Could not load snoozed emails. Refresh the page.
        </p>
      ) : null}
      {scanning ? (
        <div className="flex min-h-0 min-w-0 flex-1">
          {narrow ? null : (
            <InboxListPane narrow={false}>
              <InboxListHeader
                scanning
                onScan={() => void onScan()}
                view={view}
                onViewChange={(next) =>
                  dispatch({ type: "view_changed", view: next })
                }
              />
              <InboxSkeletonRows />
            </InboxListPane>
          )}
          <Scanning progress={scanning} />
        </div>
      ) : null}
      {!scanning && showConnect ? (
        <InboxConnect
          url={connect.data?.url ?? null}
          pending={skipping}
          onSkip={() => void onSkip()}
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
                onViewChange={(next) =>
                  dispatch({ type: "view_changed", view: next })
                }
                onOpen={(id) => dispatch({ type: "thread_opened", id })}
                onScan={() => void onScan()}
              />
            </InboxListPane>
          )}
          {!narrow && !shownId && view === "inbox" ? (
            <InboxOverview threads={threads} />
          ) : null}
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
          {shownId && detail.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Loading inbox.
            </p>
          ) : null}
          {shownId && detail.isError ? (
            <p role="alert" className="px-5 py-6 text-sm">
              Could not load inbox. Refresh the page.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type ScanProgress = {
  emails: number | null
  companies: number | null
  names: string[]
}

function Scanning({ progress }: { progress: ScanProgress }) {
  return (
    <section
      aria-label="Scanning"
      data-pen-section="Detail pane"
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 pb-10"
    >
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card shadow-xs">
        <GmailMark className="h-3.75 w-5" />
      </span>
      <h2
        className="text-[15px] font-semibold text-foreground"
        data-user-content
      >
        Finding your job emails
      </h2>
      <div
        role="progressbar"
        aria-label="Scanning"
        className="h-1 w-65 max-w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-5/8 rounded-full bg-foreground motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
      {progress.emails != null && progress.companies != null ? (
        <p data-user-content className="text-[12.5px] text-muted-foreground">
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

function messageOf(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Could not load inbox. Refresh the page."
}

function panelHold() {
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
    window.setTimeout(resolve, ms)
  })
}
