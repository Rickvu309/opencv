import { useReducer } from "react"
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
import { useRunCommand } from "@/lib/contract-client.ts"

type DeleteState = { confirm: string; error?: string; pending: boolean }

type DeleteAction =
  | { type: "confirm_typed"; value: string }
  | { type: "dismissed" }
  | { type: "delete_started" }
  | { type: "delete_failed"; message: string }
  | { type: "delete_ended" }

const DELETE_START: DeleteState = { confirm: "", pending: false }

function deleteReducer(state: DeleteState, action: DeleteAction): DeleteState {
  switch (action.type) {
    case "confirm_typed":
      return { ...state, confirm: action.value }
    case "dismissed":
      return { ...state, confirm: "", error: undefined }
    case "delete_started":
      return { ...state, pending: true, error: undefined }
    case "delete_failed":
      return { ...state, error: action.message }
    case "delete_ended":
      return { ...state, pending: false }
  }
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const runCommand = useRunCommand()
  const [{ confirm, error, pending }, dispatch] = useReducer(
    deleteReducer,
    DELETE_START
  )
  const ready = confirm === "DELETE"

  function close(next: boolean) {
    if (!next) {
      dispatch({ type: "dismissed" })
    }
    onOpenChange(next)
  }

  async function onDelete() {
    if (!ready) return
    dispatch({ type: "delete_started" })
    try {
      await runCommand("account.delete", { confirm: "DELETE" })
      await authClient.signOut()
      await navigate({ href: "/sign-in" })
    } catch (caught) {
      dispatch({
        type: "delete_failed",
        message: caught instanceof Error ? caught.message : "Try again.",
      })
    } finally {
      dispatch({ type: "delete_ended" })
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
            onChange={(event) =>
              dispatch({ type: "confirm_typed", value: event.target.value })
            }
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="outline"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-11 md:h-8"
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
