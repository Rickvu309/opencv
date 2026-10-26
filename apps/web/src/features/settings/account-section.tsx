import { useRef, useState } from "react"
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
import { toast } from "@workspace/ui/components/sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { CodeInput } from "@/features/auth/code-input.tsx"
import { authClient } from "@/lib/auth-client.ts"

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
  requestEmailChange,
  uploadPhoto,
  type SettingsProfile,
  type SettingsSave,
} from "./settings-api.ts"

export function AccountSection({
  profile,
  pending,
  errorKey,
  error,
  onSave,
}: SettingsSave & { profile: SettingsProfile }) {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string>()
  const [draftName, setDraftName] = useState<string | null>(null)
  const name =
    draftName !== null && draftName !== profile.name ? draftName : profile.name
  const [nameError, setNameError] = useState<string>()
  const [emailOpen, setEmailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function onPhoto(file: File | undefined) {
    if (!file) return
    const rejection = photoRejection(file)
    if (rejection) {
      setPhotoError(rejection)
      return
    }
    setPhotoError(undefined)
    void uploadPhoto(file)
      .then(() => setPhotoUrl(URL.createObjectURL(file)))
      .catch((caught: unknown) => {
        setPhotoError(
          caught instanceof Error ? caught.message : PHOTO_REJECTION
        )
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
                  {photoUrl ? <AvatarImage alt="" src={photoUrl} /> : null}
                  <AvatarFallback>{initials(profile.name)}</AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Change photo
                </Button>
                {/* Documented exception: native file input. Kit Input cannot host a hidden file picker. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => {
                    onPhoto(event.target.files?.[0])
                    event.target.value = ""
                  }}
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
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => {
                  const next = name.trim()
                  if (!next) {
                    setNameError(NAME_REJECTION)
                    return
                  }
                  setNameError(undefined)
                  setDraftName(next)
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
                onClick={() => setEmailOpen(true)}
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
                      toast(
                        caught instanceof Error
                          ? caught.message
                          : "Try the export again."
                      )
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
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          }
        />
      </SettingsCard>
      <ChangeEmailDialog
        open={emailOpen}
        current={profile.email}
        onOpenChange={setEmailOpen}
      />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
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
  const [email, setEmail] = useState(current)
  const [error, setError] = useState<string>()
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [focusNonce, setFocusNonce] = useState(0)

  function close(next: boolean) {
    if (!next) {
      setError(undefined)
      setPendingEmail(null)
      setCode("")
      setEmail(current)
    }
    onOpenChange(next)
  }

  async function submit() {
    const rejection = emailRejection(email)
    if (rejection) {
      setError(rejection)
      return
    }
    setError(undefined)
    try {
      const result = await requestEmailChange(email.trim())
      if (!result.sent) {
        setError("We could not send the code. Try again.")
        return
      }
      setPendingEmail(result.email)
      setFocusNonce((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Try again.")
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
      setError("We could not send the code. Try again.")
      return
    }
    const result = await otpClient.changeEmail({
      newEmail: pendingEmail,
      otp,
    })
    if (result.error) {
      setError(result.error.message ?? "That code is incorrect or expired.")
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
            onChange={setCode}
            onComplete={(otp) => void onCode(otp)}
          />
        ) : (
          <Field label="Email" error={error}>
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "You"
}
