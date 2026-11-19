import { useReducer, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Bell } from "lucide-react"
import type { NotifyTopic } from "@workspace/domain"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { PageHeaderTitle } from "@workspace/ui/components/page-header"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import "@/features/coming-soon/design/page-header.css"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { requestNotify } from "@/features/coming-soon/notify.ts"
import {
  initialNotifyState,
  notifyReducer,
} from "@/features/coming-soon/notify.reducer.ts"

type ComingSoonPageProps = {
  pageTitle: string
  title: string
  body: string
  primary: { label: string; topic: NotifyTopic }
  secondary?: { label: string; to: string }
  preview: ReactNode
}

export function ComingSoonPage({
  pageTitle,
  title,
  body,
  primary,
  secondary,
  preview,
}: ComingSoonPageProps) {
  const queryClient = useQueryClient()
  const [{ pending, error }, dispatch] = useReducer(
    notifyReducer,
    initialNotifyState
  )

  async function onNotify() {
    dispatch({ type: "requested" })
    try {
      const result = await requestNotify(queryClient, primary.topic)
      toast(result.already ? soonCopy.already : soonCopy.onList)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.trim() : ""
      dispatch({
        type: "failed",
        message: message || "Could not save that. Try again.",
      })
    } finally {
      dispatch({ type: "settled" })
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-background">
      <WorkspaceHeader data-surface="coming-soon">
        <PageHeaderTitle>{pageTitle}</PageHeaderTitle>
      </WorkspaceHeader>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-10 overflow-y-auto pt-18">
        <div className="flex w-[min(560px,calc(100%-3rem))] flex-col items-center gap-4 text-center">
          <Badge
            variant="outline"
            className="h-7 gap-1.5 rounded-[14px] px-3 text-[12.5px] text-foreground/90"
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
            />
            {soonCopy.kicker}
          </Badge>
          <h2 className="text-[38px] leading-tight font-semibold tracking-[-1.4px] text-balance text-foreground">
            {title}
          </h2>
          <p className="max-w-[460px] text-[15.5px] leading-normal text-foreground/65">
            {body}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              type="button"
              variant="primary"
              className="h-11 gap-2 rounded-[10px] px-[18px] font-semibold md:h-[42px]"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void onNotify()}
            >
              <Bell />
              {primary.label}
            </Button>
            {secondary ? (
              <Link
                to={secondary.to}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground md:min-h-6 md:px-2"
              >
                {secondary.label}
                <ArrowRight className="size-[13px]" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="relative min-h-80 w-[min(760px,calc(100%-3rem))] flex-1 overflow-hidden">
          <div className="min-h-[520px] overflow-hidden rounded-[18px] border border-border bg-card">
            {preview}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] max-h-[80%] bg-gradient-to-t from-background to-transparent"
          />
        </div>
      </div>
    </div>
  )
}
