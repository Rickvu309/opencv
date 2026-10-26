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
import { Field } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { authClient } from "@/lib/auth-client.ts"

import { deleteAccount } from "./settings-api.ts"

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const ready = confirm === "DELETE"

  function close(next: boolean) {
    if (!next) {
      setConfirm("")
      setError(undefined)
    }
    onOpenChange(next)
  }

  async function onDelete() {
    if (!ready) return
    setPending(true)
    setError(undefined)
    try {
      await deleteAccount()
      await authClient.signOut()
      await navigate({ href: "/sign-in" })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            All your Paper, Apply jobs and Pitch go with it. This can't be
            undone.
          </DialogDescription>
        </DialogHeader>
        <Field label="Type DELETE to confirm" error={error}>
          <Input
            value={confirm}
            autoFocus
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!ready || pending}
            onClick={() => void onDelete()}
          >
            Delete account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
