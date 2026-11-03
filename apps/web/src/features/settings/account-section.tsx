import { useReducer, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { Profile } from "@workspace/domain"
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
import { toast } from "@workspace/ui/components/sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { HiddenFilePicker } from "@/components/hidden-file-picker.tsx"
import { CodeInput } from "@/features/auth/code-input.tsx"
import { profileKey } from "@/lib/account-api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { resolveProfileImageSrc } from "@/lib/requests.ts"

import {
  ACCOUNT_START,
  accountReducer,
  emailReducer,
  initialEmailState,
} from "./account-section.reducer.ts"
import { DeleteAccountDialog } from "./delete-account-dialog.tsx"
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsTitle,
} from "./settings-layout.tsx"
import {
  downloadExport,
  emailRejection,
  NAME_REJECTION,
  photoRejection,
  PHOTO_REJECTION,
  uploadPhoto,
  type SettingsSave,
} from "./settings-api.ts"

export function AccountSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: SettingsSave & { profile: Profile }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [
    { photoError, draftName, nameError, emailOpen, deleteOpen },
    dispatch,
  ] = useReducer(accountReducer, ACCOUNT_START)
  const name =
    draftName !== null && draftName !== profile.name ? draftName : profile.name
  const photoSrc = resolveProfileImageSrc(profile.image)

  function onPhoto(file: File | undefined) {
    if (!file) return
    const rejection = photoRejection(file)
    if (rejection) {
      dispatch({ type: "photo_rejected", message: rejection })
      return
    }
    dispatch({ type: "photo_upload_started" })
    void uploadPhoto(file)
      .then((next) => {
        queryClient.setQueryData(profileKey(), next)
      })
      .catch((caught: unknown) => {
        dispatch({
          type: "photo_upload_failed",
          message: caught instanceof Error ? caught.message : PHOTO_REJECTION,
        })
      })
  }

  return (
    <>
      <SettingsTitle title="Account" />
      <SettingsSection label="Profile">
        <SettingsCard>
          <SettingsRow
            label="Change photo"
            desc={profile.email}
            error={photoError}
            control={
              <>
                <Avatar size="lg">
                  {photoSrc ? <AvatarImage alt="" src={photoSrc} /> : null}
                  <AvatarFallback>{initials(profile.name)}</AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Change photo
                </Button>
                <HiddenFilePicker
                  ref={fileRef}
                  accept="image/*"
                  onFile={onPhoto}
                />
              </>
            }
          />
          <SettingsRow
            label="Name"
            error={nameError ?? (errorKey === "name" ? error : undefined)}
            control={
              <Input
                aria-label="Name"
                value={name}
                disabled={pending}
                onChange={(event) =>
                  dispatch({ type: "name_typed", value: event.target.value })
                }
                onBlur={() => {
                  const next = name.trim()
                  if (!next) {
                    dispatch({ type: "name_rejected", message: NAME_REJECTION })
                    return
                  }
                  dispatch({ type: "name_committed", name: next })
                  if (next !== profile.name) onSave({ name: next })
                }}
              />
            }
          />
          <SettingsRow
            label="Email"
            desc="We send sign-in codes here"
            control={
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  dispatch({ type: "email_dialog_changed", open: true })
                }
              >
                Change email
              </Button>
            }
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label="Data">
        <SettingsCard>
          <SettingsRow
            label="Export your data"
            desc="Paper, Apply and Pitch as files"
            control={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void downloadExport()
                    .then(() => toast("Export started"))
                    .catch((caught: unknown) => {
                      toast(serverMessage(caught))
                    })
                }}
              >
                Export
              </Button>
            }
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsCard>
        <SettingsRow
          label="Sign out"
          desc="Signed in on this device"
          control={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void authClient
                  .signOut()
                  .then(() => navigate({ href: "/sign-in" }))
              }}
            >
              Sign out
            </Button>
          }
        />
        <SettingsRow
          label="Delete account"
          desc="Removes your Paper, Apply jobs and Pitch"
          control={
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                dispatch({ type: "delete_dialog_changed", open: true })
              }
            >
              Delete account
            </Button>
          }
        />
      </SettingsCard>
      <ChangeEmailDialog
        open={emailOpen}
        current={profile.email}
        onOpenChange={(open) =>
          dispatch({ type: "email_dialog_changed", open })
        }
      />
      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={(open) =>
          dispatch({ type: "delete_dialog_changed", open })
        }
      />
    </>
  )
}

function ChangeEmailDialog({
  open,
  current,
  onOpenChange,
}: {
  open: boolean
  current: string
  onOpenChange: (open: boolean) => void
}) {
  const runCommand = useRunCommand()
  const [{ email, error, pendingEmail, code, focusNonce }, dispatch] =
    useReducer(emailReducer, current, initialEmailState)

  function close(next: boolean) {
    if (!next) {
      dispatch({ type: "dismissed", current })
    }
    onOpenChange(next)
  }

  async function submit() {
    const rejection = emailRejection(email)
    if (rejection) {
      dispatch({ type: "failed", message: rejection })
      return
    }
    dispatch({ type: "submit_started" })
    try {
      const result = await runCommand("account.requestEmailChange", {
        email: email.trim(),
      })
      if (!result.sent) {
        dispatch({
          type: "failed",
          message: result.message?.trim() ? result.message : "Try again.",
        })
        return
      }
      dispatch({ type: "code_sent", email: result.email })
    } catch (caught) {
      dispatch({ type: "failed", message: serverMessage(caught) })
    }
  }

  async function onCode(otp: string) {
    if (!pendingEmail) return
    const otpClient = authClient.emailOtp as {
      changeEmail?: (input: {
        newEmail: string
        otp: string
      }) => Promise<{ error: { message?: string } | null }>
    }
    if (!otpClient.changeEmail) {
      dispatch({ type: "failed", message: "Try again." })
      return
    }
    const result = await otpClient.changeEmail({
      newEmail: pendingEmail,
      otp,
    })
    if (result.error) {
      dispatch({
        type: "failed",
        message: result.error.message?.trim()
          ? result.error.message
          : "Try again.",
      })
      return
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>We send sign-in codes here</DialogDescription>
        </DialogHeader>
        {pendingEmail ? (
          <CodeInput
            value={code}
            disabled={false}
            focusNonce={focusNonce}
            onChange={(value) => dispatch({ type: "code_typed", value })}
            onComplete={(otp) => void onCode(otp)}
          />
        ) : (
          <Field label="Email" error={error}>
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(event) =>
                dispatch({ type: "email_typed", value: event.target.value })
              }
            />
          </Field>
        )}
        {pendingEmail && error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          {pendingEmail ? null : (
            <Button type="button" onClick={() => void submit()}>
              Change email
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function serverMessage(caught: unknown) {
  return caught instanceof Error && caught.message.trim()
    ? caught.message
    : "Try again."
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "You"
}
