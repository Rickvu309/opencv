import { useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Bell } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { soonCopy } from "@/features/coming-soon/copy.ts"
import {
  requestNotify,
  type NotifyTopic,
} from "@/features/coming-soon/notify.ts"

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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onNotify() {
    setPending(true)
    setError(null)
    try {
      const result = await requestNotify(primary.topic)
      toast(result.already ? soonCopy.already : soonCopy.onList)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.trim() : ""
      setError(message || "Could not save that. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 pt-24 pb-16">
        <header className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{pageTitle}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
            />
            {soonCopy.kicker}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{body}</p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="glow"
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
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-auto whitespace-normal"
              )}
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          {preview}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent"
          />
        </div>
      </div>
    </div>
  )
}
