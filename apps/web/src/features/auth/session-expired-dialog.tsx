import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { authClient } from "@/lib/auth-client.ts"
import { SIGNED_OUT_EMAIL_KEY } from "@/lib/auth-redirect.ts"

import {
  AUTH_COPY,
  continueAsLabel,
  LANGUAGE_STORAGE_KEY,
} from "./auth-copy.ts"

export function SessionExpiredDialog({
  open,
  email,
}: {
  open: boolean
  email: string | null
}) {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function continueAs() {
    if (!email) return
    setPending(true)
    setNotice(null)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })
      if (result.error) {
        setNotice(AUTH_COPY.sendFailed)
        return
      }
      await navigate({ to: "/sign-in", search: { email } })
    } catch {
      setNotice(AUTH_COPY.sendFailed)
    } finally {
      setPending(false)
    }
  }

  async function logOut() {
    await authClient.signOut()
    sessionStorage.removeItem(SIGNED_OUT_EMAIL_KEY)
    sessionStorage.removeItem(LANGUAGE_STORAGE_KEY)
    await navigate({ to: "/sign-in" })
  }

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (!next) details.cancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-md:max-w-[calc(100%-2rem)]"
      >
        <DialogHeader>
          <DialogTitle>{AUTH_COPY.loggedOutTitle}</DialogTitle>
          <DialogDescription>{AUTH_COPY.loggedOutBody}</DialogDescription>
        </DialogHeader>
        {notice ? (
          <p role="alert" className="text-sm text-destructive">
            {notice}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {email ? (
            <Button
              type="button"
              variant="glow"
              className="w-full"
              autoFocus
              disabled={pending}
              onClick={() => void continueAs()}
            >
              {continueAsLabel(email)}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            autoFocus={!email}
            onClick={() => void navigate({ to: "/sign-in" })}
          >
            {AUTH_COPY.emailMe}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void logOut()}
          >
            {AUTH_COPY.logOut}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
