import { useState, type ReactNode } from "react"
import {
  APPLY_JOB_URL_BLOCKED,
  APPLY_JOB_URL_INVALID,
  applyJobSourceHost,
  isDemoApplyCard,
  openableApplyJobUrl,
  parseApplyJobUrlInput,
  publicApplyJobUrl,
  type PaperDoc,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { ExternalLink, Link2, Star, Trash2, X } from "lucide-react"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { scanApplyJob } from "@/features/apply/apply-api.ts"
import {
  GUIDED_APPLY_PREP_ACTION,
  guidedApplyNextAction,
} from "@/features/apply/apply-guide.ts"
import { paperDocsLinkedToCard } from "@/features/paper/paper-apply-attach.ts"
import {
  APPLY_DEMO_HINT,
  APPLY_DEMO_LABEL,
  APPLY_JOB_DATE_LABEL,
  APPLY_JOB_NEXT_STEP_LABEL,
  APPLY_JOB_NOTES_PLACEHOLDER,
  APPLY_JOB_SOURCE_LABEL,
  APPLY_JOB_SOURCE_PLACEHOLDER,
} from "@/features/apply/apply-job-structure.ts"
import { ApiError } from "@/lib/api-error.ts"
import {
  formatApplyUpdated,
  STAGES,
  trackKindLabel,
  type ApplyCard,
  type StageId,
  type TrackKind,
} from "@/features/apply/apply-types.ts"

type Props = {
  card: ApplyCard
  guided?: boolean
  revertKey: number
  paperDocs: PaperDoc[]
  onClose: () => void
  onPatch: (
    patch: Partial<
      Pick<
        ApplyCard,
        "title" | "company" | "note" | "jobUrl" | "trackDate" | "trackKind"
      >
    >
  ) => void
  onMove: (stage: StageId) => void
  onToggleStar: () => void
  onRemove: () => void
  onLinkPaper: (docId: string, applyCardId: string | null) => void
}

const TRACK_KINDS: TrackKind[] = [
  "interview",
  "deadline",
  "followup",
  "applied",
]

const FIELD_LABEL =
  "mb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase"

export function JobDetailPanel({
  card,
  guided = false,
  revertKey,
  paperDocs,
  onClose,
  onPatch,
  onMove,
  onToggleStar,
  onRemove,
  onLinkPaper,
}: Props) {
  const stageLabel = STAGES.find((s) => s.id === card.stage)?.label ?? "Inbox"
  const guidedAction = guided ? guidedApplyNextAction(card) : null
  const linkedPaper = paperDocsLinkedToCard(paperDocs, card.id)
  const [linkOpen, setLinkOpen] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const postingUrl = publicApplyJobUrl(card.jobUrl)

  function openPosting() {
    const href = openableApplyJobUrl(postingUrl)
    if (!href) {
      setOpenError(APPLY_JOB_URL_INVALID)
      return
    }
    const opened = window.open(href, "_blank", "noopener,noreferrer")
    if (!opened) {
      setOpenError(APPLY_JOB_URL_BLOCKED)
      return
    }
    setOpenError(null)
  }

  return (
    <aside
      aria-label="Job detail"
      className="flex w-80 shrink-0 flex-col border-l border-border bg-background shadow-[-4px_0_24px_oklch(0_0_0/0.04)]"
    >
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-2">
        <ToolbarIconButton
          label={card.starred ? "Unstar job" : "Star job"}
          onClick={onToggleStar}
          active={card.starred}
        >
          <Star
            className={cn(
              "size-3.5",
              card.starred && "fill-foreground/20 text-foreground"
            )}
          />
        </ToolbarIconButton>

        <StageMenu value={card.stage} label={stageLabel} onChange={onMove} />

        <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        {postingUrl ? (
          <ToolbarIconButton label="Open job posting" onClick={openPosting}>
            <ExternalLink className="size-3.5" />
          </ToolbarIconButton>
        ) : null}
        <PaperLinkMenu
          open={linkOpen}
          onOpenChange={setLinkOpen}
          cardId={card.id}
          docs={paperDocs}
          onLink={onLinkPaper}
        />
        <ToolbarIconButton
          label="Delete job"
          onClick={onRemove}
          className="hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </ToolbarIconButton>

        <ToolbarIconButton
          label="Close panel"
          onClick={onClose}
          className="ml-auto"
        >
          <X className="size-3.5" />
        </ToolbarIconButton>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {openError ? (
          <ErrorBanner variant="inline">{openError}</ErrorBanner>
        ) : null}

        {isDemoApplyCard(card) ? (
          <div role="status" className="space-y-1.5">
            <Badge variant="secondary">{APPLY_DEMO_LABEL}</Badge>
            <p className="text-sm text-muted-foreground">{APPLY_DEMO_HINT}</p>
          </div>
        ) : null}

        {guidedAction?.kind === "stage" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 self-start"
            onClick={() => onMove(guidedAction.stage)}
          >
            {GUIDED_APPLY_PREP_ACTION}
          </Button>
        ) : null}

        {linkedPaper.length > 0 ? (
          <div role="region" aria-label="Linked Paper">
            <p className={FIELD_LABEL}>Paper</p>
            <ul className="grid gap-1">
              {linkedPaper.map((doc) => (
                <li key={doc.id} className="text-sm">
                  {doc.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <JobDetailFields
          key={`${card.id}:${revertKey}:${card.title}:${card.company}:${card.jobUrl}`}
          card={card}
          onPatch={onPatch}
        />

        <JobDetailNote
          key={`${card.id}:note:${revertKey}:${card.note}`}
          note={card.note}
          onCommit={(next) => onPatch({ note: next })}
        />

        <p className="text-micro text-muted-foreground">
          {formatApplyUpdated(card.updatedAt)}
        </p>
      </div>
    </aside>
  )
}

function JobDetailFields({
  card,
  onPatch,
}: {
  card: ApplyCard
  onPatch: Props["onPatch"]
}) {
  const [title, setTitle] = useState(card.title)
  const [company, setCompany] = useState(card.company)
  const [jobUrl, setJobUrl] = useState(publicApplyJobUrl(card.jobUrl) ?? "")
  const [jobUrlError, setJobUrlError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const postingUrl = openableApplyJobUrl(jobUrl)

  function commitTitle() {
    const next = title.trim()
    if (!next || next === card.title) {
      setTitle(card.title)
      return
    }
    onPatch({ title: next })
  }

  function commitCompany() {
    const next = company.trim()
    if (!next || next === card.company) {
      setCompany(card.company)
      return
    }
    onPatch({ company: next })
  }

  function commitJobUrl() {
    const parsed = parseApplyJobUrlInput(jobUrl)
    if (!parsed.ok) {
      setJobUrlError(parsed.message)
      setJobUrl(card.jobUrl ?? "")
      return
    }
    setJobUrlError(null)
    setJobUrl(parsed.jobUrl ?? "")
    if (parsed.jobUrl !== (card.jobUrl ?? null)) {
      onPatch({ jobUrl: parsed.jobUrl })
    }
  }

  async function scanPosting() {
    const href = openableApplyJobUrl(jobUrl)
    if (!href) {
      setScanError(APPLY_JOB_URL_INVALID)
      return
    }
    setScanning(true)
    setScanError(null)
    try {
      const result = await scanApplyJob({ jobUrl: href })
      const patch: Parameters<Props["onPatch"]>[0] = {}
      if (result.title) patch.title = result.title
      if (result.company) patch.company = result.company
      if (result.note && !card.note.trim()) patch.note = result.note
      if (result.title) setTitle(result.title)
      if (result.company) setCompany(result.company)
      if (Object.keys(patch).length > 0) onPatch(patch)
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

  const sourceHost = applyJobSourceHost(jobUrl)

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="block">
          <Label htmlFor={`job-title-${card.id}`} className={FIELD_LABEL}>
            Job title
          </Label>
          <Input
            id={`job-title-${card.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            className="font-semibold"
          />
        </div>
        <div className="block">
          <Label htmlFor={`company-${card.id}`} className={FIELD_LABEL}>
            Company
          </Label>
          <Input
            id={`company-${card.id}`}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={commitCompany}
          />
        </div>
      </div>

      <section
        aria-labelledby={`source-heading-${card.id}`}
        className="space-y-2"
      >
        <h2 id={`source-heading-${card.id}`} className={FIELD_LABEL}>
          {APPLY_JOB_SOURCE_LABEL}
        </h2>
        <div className="block">
          <Label htmlFor={`job-url-${card.id}`} className="sr-only">
            {APPLY_JOB_SOURCE_LABEL}
          </Label>
          <Input
            id={`job-url-${card.id}`}
            type="text"
            inputMode="url"
            autoComplete="url"
            value={jobUrl}
            onChange={(e) => {
              setJobUrl(e.target.value)
              if (jobUrlError) setJobUrlError(null)
            }}
            onBlur={commitJobUrl}
            placeholder={APPLY_JOB_SOURCE_PLACEHOLDER}
            aria-invalid={Boolean(jobUrlError)}
          />
          {sourceHost ? (
            <p className="mt-1 text-micro text-muted-foreground">
              {sourceHost}
            </p>
          ) : null}
          {jobUrlError ? (
            <ErrorBanner variant="inline" className="mt-1">
              {jobUrlError}
            </ErrorBanner>
          ) : null}
          {postingUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-8"
              disabled={scanning}
              onClick={() => void scanPosting()}
            >
              {scanning ? "Scanning…" : "Scan posting"}
            </Button>
          ) : null}
          {scanError ? (
            <ErrorBanner variant="inline" className="mt-2">
              {scanError}
            </ErrorBanner>
          ) : null}
        </div>
      </section>

      <JobDetailNextStep card={card} onPatch={onPatch} />
    </div>
  )
}

function JobDetailNextStep({
  card,
  onPatch,
}: {
  card: ApplyCard
  onPatch: Props["onPatch"]
}) {
  return (
    <section
      aria-labelledby={`next-step-heading-${card.id}`}
      className="space-y-2"
    >
      <h2 id={`next-step-heading-${card.id}`} className={FIELD_LABEL}>
        {APPLY_JOB_NEXT_STEP_LABEL}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="block">
          <Label htmlFor={`event-type-${card.id}`} className="sr-only">
            {APPLY_JOB_NEXT_STEP_LABEL}
          </Label>
          <Select
            value={card.trackKind}
            onValueChange={(kind) => {
              if (kind) onPatch({ trackKind: kind as TrackKind })
            }}
          >
            <SelectTrigger
              id={`event-type-${card.id}`}
              className="w-full"
              aria-label={APPLY_JOB_NEXT_STEP_LABEL}
            >
              <SelectValue>{trackKindLabel(card.trackKind)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TRACK_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {trackKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="block">
          <Label htmlFor={`track-date-${card.id}`} className="sr-only">
            {APPLY_JOB_DATE_LABEL}
          </Label>
          <Input
            id={`track-date-${card.id}`}
            type="date"
            value={card.trackDate}
            onChange={(e) => onPatch({ trackDate: e.target.value })}
            aria-label={APPLY_JOB_DATE_LABEL}
          />
        </div>
      </div>
    </section>
  )
}

function JobDetailNote({
  note,
  onCommit,
}: {
  note: string
  onCommit: (note: string) => void
}) {
  const [value, setValue] = useState(note)

  return (
    <div className="block">
      <Label htmlFor="job-notes" className={FIELD_LABEL}>
        Notes
      </Label>
      <Textarea
        id="job-notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== note) onCommit(value)
        }}
        rows={5}
        className="min-h-0 resize-none leading-relaxed"
        placeholder={APPLY_JOB_NOTES_PLACEHOLDER}
      />
    </div>
  )
}

function PaperLinkMenu({
  open,
  onOpenChange,
  cardId,
  docs,
  onLink,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardId: string
  docs: PaperDoc[]
  onLink: (docId: string, applyCardId: string | null) => void
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link Paper docs"
            className={cn(
              "text-muted-foreground",
              (open || docs.some((doc) => doc.applyCardId === cardId)) &&
                "bg-muted text-foreground"
            )}
          />
        }
      >
        <Link2 className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-label="Link Paper docs"
        className="max-h-64 w-64"
      >
        {docs.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No Paper docs yet.
          </p>
        ) : (
          docs.map((doc) => {
            const linkedHere = doc.applyCardId === cardId
            return (
              <DropdownMenuCheckboxItem
                key={doc.id}
                checked={linkedHere}
                onCheckedChange={() =>
                  onLink(doc.id, linkedHere ? null : cardId)
                }
              >
                <span className="min-w-0 flex-1 truncate">{doc.name}</span>
              </DropdownMenuCheckboxItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StageMenu({
  value,
  label,
  onChange,
}: {
  value: StageId
  label: string
  onChange: (stage: StageId) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Stage: ${label}`}
            className="h-8 text-xs font-medium text-muted-foreground"
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8.5rem]">
        {STAGES.map((stage) => (
          <DropdownMenuItem
            key={stage.id}
            onClick={() => onChange(stage.id)}
            className={cn(value === stage.id && "bg-muted font-medium")}
          >
            <span className={cn("size-1.5 rounded-full", stage.dot)} />
            {stage.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToolbarIconButton({
  label,
  onClick,
  children,
  active,
  className,
  disabled,
}: {
  label: string
  onClick?: () => void
  children?: ReactNode
  active?: boolean
  className?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Coming soon" : undefined}
      className={cn(
        "text-muted-foreground",
        active && "bg-muted text-foreground",
        className
      )}
    >
      {children}
    </Button>
  )
}
