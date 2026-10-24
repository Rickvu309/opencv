import { useState } from "react"
import {
  APPLY_JOB_URL_COPY_FAILED,
  type ApplyScanResult,
  openableApplyJobUrl,
  parseApplyScanInput,
} from "@workspace/domain"
import { scanApplyJob } from "@/features/apply/apply-api.ts"
import { copyApplyJobUrl } from "@/features/apply/apply-open-posting.ts"
import type { ApplyCard } from "@/features/apply/apply-types.ts"
import { ApiError } from "@/lib/api-error.ts"
import { useFlash } from "@/lib/use-flash.ts"

type JobPatch = Partial<Pick<ApplyCard, "title" | "company" | "note">>

export function useJobPosting({
  card,
  jobUrl,
  onPatch,
  onScanned,
}: {
  card: ApplyCard
  jobUrl: string
  onPatch: (patch: JobPatch) => void
  onScanned: (scanned: Pick<ApplyScanResult, "title" | "company">) => void
}) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanJdText, setScanJdText] = useState("")
  const [flashing, flashCopied] = useFlash(2000)
  const [copyError, setCopyError] = useState<string | null>(null)
  const copied = flashing && copyError === null

  async function copyPosting() {
    const href = openableApplyJobUrl(jobUrl)
    if (!href) {
      setCopyError(APPLY_JOB_URL_COPY_FAILED)
      return
    }
    const ok = await copyApplyJobUrl(href)
    if (!ok) {
      setCopyError(APPLY_JOB_URL_COPY_FAILED)
      return
    }
    setCopyError(null)
    flashCopied()
  }

  async function scanPosting() {
    const parsed = parseApplyScanInput({ jobUrl, jdText: scanJdText })
    if (!parsed.ok) {
      setScanError(parsed.message)
      return
    }
    setScanning(true)
    setScanError(null)
    try {
      const result = await scanApplyJob({
        ...(parsed.jobUrl ? { jobUrl: parsed.jobUrl } : {}),
        ...(parsed.jdText ? { jdText: parsed.jdText } : {}),
      })
      const patch: JobPatch = {}
      if (result.title) patch.title = result.title
      if (result.company) patch.company = result.company
      if (result.note && !card.note.trim()) patch.note = result.note
      onScanned({ title: result.title, company: result.company })
      if (Object.keys(patch).length > 0) onPatch(patch)
      setScanJdText("")
    } catch (error) {
      setScanError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Couldn't scan that post."
      )
    } finally {
      setScanning(false)
    }
  }

  return {
    scanning,
    scanError,
    scanJdText,
    setScanJdText,
    copied,
    copyError,
    scanPosting,
    copyPosting,
  }
}
