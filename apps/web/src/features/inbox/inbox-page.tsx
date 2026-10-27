import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/sonner"
import { PageHeader } from "@workspace/ui/components/page-header"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"

import { ApiError } from "@/lib/api.ts"
import { queryKey, useRunCommand } from "@/lib/contract-client.ts"
import { PROFILE_ZONE } from "@/features/apply/apply-stages.ts"

import { InboxConnect } from "./inbox-connect.tsx"
import {
  fetchConnect,
  fetchInbox,
  fetchThread,
  inboxListKey,
} from "./inbox-api.ts"
import { InboxEmpty, InboxList } from "./inbox-list.tsx"
import { CompanyTile } from "./inbox-parts.tsx"
import { InboxReader } from "./inbox-reader.tsx"
import { inboxConnectKey } from "@/lib/requests.ts"

const NARROW = "(max-width: 767px)"

export function InboxPage() {
  const runCommand = useRunCommand()
  const narrow = useMediaQuery(NARROW, false)
  const now = new Date()
  const list = useQuery({
    queryKey: inboxListKey(),
    queryFn: fetchInbox,
  })
  const showConnect = Boolean(
    list.data && !list.data.connected && !list.data.skipped
  )
  const connect = useQuery({
    queryKey: inboxConnectKey,
    queryFn: fetchConnect,
    enabled: showConnect,
  })
  const [openId, setOpenId] = useState<string | null>(null)
  const [scanning, setScanning] = useState<ScanProgress | null>(null)
  const [skipping, setSkipping] = useState(false)
  const threads = list.data?.threads ?? []
  const zone = list.data?.timeZone || PROFILE_ZONE
  const shownId = narrow
    ? openId
    : openId && threads.some((thread) => thread.id === openId)
      ? openId
      : (threads[0]?.id ?? null)
  const detail = useQuery({
    queryKey: queryKey({
      query: "inbox.get",
      input: { threadId: shownId ?? "" },
    }),
    queryFn: () => fetchThread(shownId ?? ""),
    enabled: Boolean(shownId) && scanning == null && !showConnect,
  })

  async function onSkip() {
    setSkipping(true)
    try {
      await runCommand("inbox.skip", {})
    } catch (error) {
      toast(messageOf(error))
    } finally {
      setSkipping(false)
    }
  }

  async function onScan() {
    setScanning({ emails: null, companies: null, names: [] })
    try {
      const result = await runCommand("inbox.scan", {})
      setScanning({
        emails: result.emailCount,
        companies: result.companyCount,
        names: result.threads.map((thread) => thread.company),
      })
      await panelHold()
    } catch (error) {
      toast(messageOf(error))
    } finally {
      setScanning(null)
    }
  }

  const index = threads.findIndex((thread) => thread.id === shownId)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      <PageHeader title="Inbox" />
      {list.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Loading inbox.
        </p>
      ) : null}
      {list.isError ? (
        <p role="alert" className="px-5 py-6 text-sm">
          Could not load inbox. Refresh the page.
        </p>
      ) : null}
      {scanning ? <Scanning progress={scanning} /> : null}
      {!scanning && showConnect ? (
        <InboxConnect
          url={connect.data?.url ?? null}
          pending={skipping}
          onSkip={() => void onSkip()}
        />
      ) : null}
      {!scanning && list.data && !showConnect && threads.length === 0 ? (
        <InboxEmpty scanning={false} onScan={() => void onScan()} />
      ) : null}
      {!scanning && threads.length > 0 ? (
        <div className="flex min-h-0 min-w-0 flex-1">
          {narrow && shownId ? null : (
            <div
              className={
                narrow
                  ? "min-w-0 flex-1"
                  : "w-[28rem] max-w-full shrink-0 border-r border-border"
              }
            >
              <InboxList
                threads={threads}
                openId={shownId}
                now={now}
                zone={zone}
                scanning={false}
                onOpen={setOpenId}
                onScan={() => void onScan()}
              />
            </div>
          )}
          {shownId && detail.data ? (
            <InboxReader
              key={detail.data.id}
              detail={detail.data}
              index={index + 1}
              count={threads.length}
              narrow={narrow}
              now={now}
              zone={zone}
              onBack={() => setOpenId(null)}
              onPrevious={() => {
                const previous = threads[index - 1]
                if (previous) setOpenId(previous.id)
              }}
              onNext={() => {
                const next = threads[index + 1]
                if (next) setOpenId(next.id)
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
    <div className="flex flex-col gap-4 px-5 py-8">
      <h2 className="text-lg font-medium" data-user-content>
        Finding your job emails
      </h2>
      {progress.emails != null && progress.companies != null ? (
        <p data-user-content>
          {progress.emails} emails from {progress.companies} companies so far
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-4">
        {progress.names.map((name, tile) => (
          <CompanyTile key={`${name}-${tile}`} name={name} />
        ))}
      </ul>
    </div>
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
