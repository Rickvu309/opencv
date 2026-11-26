import { useReducer, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { Profile } from "@workspace/domain/account"
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
import { useOwnerId } from "@/lib/owner-id.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { resolveProfileImageSrc } from "@/lib/requests.ts"

import {
  ACCOUNT_START,
  accountReducer,
  emailReducer,
  initialEmailState,
} from "./account-section.reducer.ts"
import { DeleteAccountDialog } from "./delete-account-dialog.tsx"
import { personInitials } from "@/lib/person-initials.ts"
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
  const ownerId = useOwnerId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [
    { photoError, draftName, nameError, emailOpen, deleteOpen },
    dispatch,
  ] = useReducer(accountReducer, ACCOUNT_START)
  const name =
    draftName !== null && draftName !== profile.name ? draftName : profile.name
  const nameMessage = nameError ?? (errorKey === "name" ? error : undefined)
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
        queryClient.setQueryData(profileKey(ownerId), next)
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
      <SettingsSection id="profile" label="Profile">
        <SettingsCard name="profile">
          <SettingsRow
            id="profile"
            gap="avatar"
            label="Photo"
            error={photoError}
            leading={
              <Avatar
                data-slot="settings-avatar"
                size="lg"
                className="data-[size=lg]:size-11"
              >
                {photoSrc ? <AvatarImage alt="" src={photoSrc} /> : null}
                <AvatarFallback className="bg-secondary text-sm font-semibold">
                  {personInitials(profile.name, profile.email)}
                </AvatarFallback>
              </Avatar>
            }
            control={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  onClick={() => fileRef.current?.click()}
                  aria-invalid={photoError ? true : undefined}
                  aria-describedby={
                    photoError ? "settings-row-profile-error" : undefined
                  }
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
            id="name"
            label="Name"
            error={nameMessage}
            errorId={nameMessage ? "account-name-error" : undefined}
            control={
              <Input
                aria-label="Name"
                aria-invalid={nameMessage ? true : undefined}
                aria-describedby={
                  nameMessage ? "account-name-error" : undefined
                }
                data-slot="settings-name-input"
                className="rounded-md text-base max-md:h-11 md:w-60 md:text-ui"
                value={name}
                readOnly={pending}
                onChange={(event) =>
                  dispatch({ type: "name_typed", value: event.target.value })
                }
                onBlur={() => {
                  if (pending) return
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
            id="email"
            label="Email"
            desc={profile.email}
            control={
              <Button
                type="button"
                variant="outline"
                size="touch"
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
      <SettingsSection id="data" label="Data">
        <SettingsCard name="data">
          <SettingsRow
            id="export"
            label="Export your data"
            desc="CVs, Letters, Jobs and Chats as files"
            control={
              <Button
                type="button"
                variant="outline"
                size="touch"
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
          <SettingsRow
            id="sign-out"
            label="Sign out"
            desc="Signed in on this device"
            control={
              <Button
                type="button"
                variant="outline"
                size="touch"
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
        </SettingsCard>
      </SettingsSection>
      <SettingsCard name="delete-account">
        <SettingsRow
          id="delete-account"
          label="Delete account"
          desc="Removes your Paper, Apply jobs and Pitch"
          control={
            <Button
              type="button"
              variant="outline"
              size="touch"
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
  const queryClient = useQueryClient()
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
      const result = await catalogClient.run(
        queryClient,
        "account.requestEmailChange",
        { email: email.trim() }
      )
      if ("pending" in result) throw new Error("The request is waiting")
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
        <form
          className="contents"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!pendingEmail) void submit()
          }}
        >
          {pendingEmail ? (
            <fieldset
              className="min-w-0"
              aria-label="Verification code"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "account-email-code-error" : undefined}
            >
              <CodeInput
                value={code}
                disabled={false}
                invalid={Boolean(error)}
                focusNonce={focusNonce}
                onChange={(value) => dispatch({ type: "code_typed", value })}
                onComplete={(otp) => void onCode(otp)}
              />
            </fieldset>
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
            <p
              id="account-email-code-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              size="touch"
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            {pendingEmail ? null : (
              <Button size="touch" type="submit">
                Change email
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function serverMessage(caught: unknown) {
  return caught instanceof Error && caught.message.trim()
    ? caught.message
    : "Try again."
}
