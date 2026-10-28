import { useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Bell } from "lucide-react"
import type { NotifyTopic } from "@workspace/domain"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"

import { soonCopy } from "@/features/coming-soon/copy.ts"
import { requestNotify } from "@/features/coming-soon/notify.ts"

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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onNotify() {
    setPending(true)
    setError(null)
    try {
      const result = await requestNotify(queryClient, primary.topic)
      toast(result.already ? soonCopy.already : soonCopy.onList)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.trim() : ""
      setError(message || "Could not save that. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-background">
      <PageHeader title={pageTitle} />
      <div className="flex min-h-0 flex-1 flex-col items-center gap-10 overflow-y-auto pt-[72px]">
        <div className="flex w-[min(560px,calc(100%-3rem))] flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="h-7 gap-1.5 rounded-[14px] px-3">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
            />
            {soonCopy.kicker}
          </Badge>
          <h2 className="text-[38px] leading-tight font-semibold tracking-tight text-balance text-foreground">
            {title}
          </h2>
          <p className="max-w-[460px] text-[15.5px] leading-normal text-muted-foreground">
            {body}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              type="button"
              variant="glow"
              className="h-[42px] gap-2 rounded-[10px] px-[18px]"
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
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
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
        <div className="relative w-[min(760px,calc(100%-3rem))] flex-1 overflow-hidden">
          <div className="min-h-[520px] rounded-[18px] border border-border bg-card">
            {preview}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] bg-gradient-to-t from-background to-transparent"
          />
        </div>
      </div>
    </div>
  )
}
