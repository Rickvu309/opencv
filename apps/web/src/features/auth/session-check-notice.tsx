import { useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  ErrorComponent,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { SessionCheckUnknown, type SessionCheck } from "@/lib/session-check.ts"

import { AUTH_COPY } from "./auth-copy.ts"

const NOTICE_ID = "session-check"

export function SessionCheckNotice({ kind }: { kind: SessionCheck["kind"] }) {
  const router = useRouter()
  useEffect(() => {
    if (kind !== "unknown") {
      toast.dismiss(NOTICE_ID)
      return
    }
    toast.warning(AUTH_COPY.sessionCheckNotice, {
      id: NOTICE_ID,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: AUTH_COPY.sessionCheckRetry,
        onClick: () => void router.invalidate(),
      },
    })
  }, [kind, router])
  return null
}

export function SessionCheckRetry() {
  const router = useRouter()
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
      <div className="flex w-full max-w-[340px] flex-col items-center gap-4 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <RefreshCw className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight">
            {AUTH_COPY.sessionCheckTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {AUTH_COPY.sessionCheckBody}
          </p>
        </div>
        <Button className="w-full" onClick={() => void router.invalidate()}>
          {AUTH_COPY.sessionCheckRetry}
        </Button>
      </div>
    </main>
  )
}

export function SessionCheckErrorBoundary({ error }: ErrorComponentProps) {
  if (error instanceof SessionCheckUnknown) return <SessionCheckRetry />
  return <ErrorComponent error={error} />
}
