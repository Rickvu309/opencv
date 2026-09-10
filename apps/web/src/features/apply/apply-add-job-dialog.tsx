import { useState } from "react"
import {
  formatApplyScanReceipt,
  parseApplyJobUrlInput,
  parseApplyScanInput,
  type ApplyScanResult,
} from "@workspace/domain"
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
import { Textarea } from "@workspace/ui/components/textarea"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { ApiError } from "@/lib/api-error.ts"

import { scanApplyJob } from "./apply-api.ts"
import {
  APPLY_JOB_SCAN_TEXT_LABEL,
  APPLY_JOB_SCAN_TEXT_PLACEHOLDER,
} from "./apply-job-structure.ts"

export type AddJobDraft = {
  jobUrl: string | null
  title?: string
  company?: string
  note?: string
}

type Props = {
  open: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (draft: AddJobDraft) => Promise<void>
}

function scanErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Couldn't scan that post."
}

export function AddJobDialog({ open, creating, onOpenChange, onAdd }: Props) {
  const [jobUrl, setJobUrl] = useState("")
  const [jdText, setJdText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<ApplyScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  function reset() {
    setJobUrl("")
    setJdText("")
    setError(null)
    setScan(null)
    setScanning(false)
  }

  function clearScan() {
    if (scan) setScan(null)
    if (error) setError(null)
  }

  async function scanPost() {
    const parsed = parseApplyScanInput({ jobUrl, jdText })
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setScanning(true)
    setError(null)
    try {
      const result = await scanApplyJob({
        ...(parsed.jobUrl ? { jobUrl: parsed.jobUrl } : {}),
        ...(parsed.jdText ? { jdText: parsed.jdText } : {}),
      })
      setScan(result)
    } catch (err) {
      setScan(null)
      setError(scanErrorMessage(err))
    } finally {
      setScanning(false)
    }
  }

  async function submit() {
    const parsed = parseApplyJobUrlInput(jobUrl)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    await onAdd({
      jobUrl: parsed.jobUrl,
      ...(scan?.title ? { title: scan.title } : {}),
      ...(scan?.company ? { company: scan.company } : {}),
      ...(scan?.note ? { note: scan.note } : {}),
    })
    reset()
  }

  const busy = creating || scanning
  const receipt = scan ? formatApplyScanReceipt(scan) : ""

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            Paste a posting link or the job text. Scan fills title and company
            when the post says them.
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
              clearScan()
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
        <div className="block">
          <Label htmlFor="add-job-jd" className="mb-1">
            {APPLY_JOB_SCAN_TEXT_LABEL}
          </Label>
          <Textarea
            id="add-job-jd"
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value)
              clearScan()
            }}
            rows={4}
            className="min-h-0 resize-none leading-relaxed"
            placeholder={APPLY_JOB_SCAN_TEXT_PLACEHOLDER}
          />
        </div>
        {receipt ? (
          <p className="text-sm text-muted-foreground">Filled {receipt}.</p>
        ) : null}
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
            variant="outline"
            disabled={busy}
            onClick={() => void scanPost()}
          >
            {scanning ? "Scanning…" : "Scan"}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            Add job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
