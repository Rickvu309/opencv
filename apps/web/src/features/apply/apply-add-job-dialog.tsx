import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { parseApplyJobUrlInput } from "@workspace/domain"

import { ErrorBanner } from "@/components/error-banner.tsx"

type Props = {
  open: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (jobUrl: string | null) => Promise<void>
}

export function AddJobDialog({ open, creating, onOpenChange, onAdd }: Props) {
  const [jobUrl, setJobUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setJobUrl("")
    setError(null)
  }

  async function submit() {
    const parsed = parseApplyJobUrlInput(jobUrl)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    await onAdd(parsed.jobUrl)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            Paste a posting link if you have one. Leave it blank for an untitled
            role.
          </DialogDescription>
        </DialogHeader>
        <div className="block">
          <Label htmlFor="add-job-url" className="mb-1">
            Job posting URL
          </Label>
          <Input
            id="add-job-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoFocus
            value={jobUrl}
            onChange={(e) => {
              setJobUrl(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="https://"
            aria-invalid={Boolean(error)}
          />
        </div>
        {error ? <ErrorBanner variant="inline">{error}</ErrorBanner> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={creating}
            onClick={() => void submit()}
          >
            Add job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
