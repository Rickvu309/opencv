import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import type { CoachSelection } from "@workspace/domain"
import { changedSectionIds, diffPaperContent } from "@workspace/domain"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import type { PaperDocStatus } from "@workspace/domain"
import {
  ChevronDown,
  FileText,
  Globe,
  MoreHorizontal,
  Share2,
} from "lucide-react"

import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { authClient } from "@/lib/auth-client.ts"

import { CvDocument } from "./paper-cv-document.tsx"
import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { applyCvTemplate } from "./paper-cv-template-picker.tsx"
import { type CvData, type CvTemplateId } from "./paper-cv-types.ts"
import {
  TYPE_LABEL,
  cvContentOf,
  formatPaperUpdated,
  letterMarkdownOf,
  profileFirstName,
  proofContentOf,
  type PaperDoc,
} from "./paper-data.ts"
import { CoachFloat } from "./coach-float.tsx"
import { readPaperSelection } from "./paper-selection.ts"
import { PaperEditorSidebar } from "./paper-editor-sidebar.tsx"
import {
  PaperEditorToolbar,
  type CvInsertId,
  type LetterInsertId,
  type ProofInsertId,
} from "./paper-editor-toolbar.tsx"
import { paperContentToHtml, paperHtmlToContent } from "./paper-markdown.ts"
import { ProofDocument } from "./paper-proof-document.tsx"
import {
  newProofStep,
  type ProofData,
  type ProofStepType,
} from "./paper-proof-types.ts"

type Props = {
  doc: PaperDoc
  docs: PaperDoc[]
  revertKey: number
  onBack: () => void
  onSelectDoc: (id: string) => void
  onChange: (doc: PaperDoc) => void
  onRename: (name: string) => void
  onStatusChange: (status: PaperDocStatus) => void
  onDelete: () => void
}

export function PaperEditor({
  doc,
  docs,
  revertKey,
  onBack,
  onSelectDoc,
  onChange,
  onRename,
  onStatusChange,
  onDelete,
}: Props) {
  const { data: session } = authClient.useSession()
  const isCv = doc.kind === "cv"
  const isProof = doc.kind === "proof"
  const isLetter = doc.kind === "letter"
  const editorRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const proofPhotoRef = useRef<HTMLInputElement>(null)
  const cvPhotoRef = useRef<HTMLInputElement>(null)
  const loadedUpdatedAtRef = useRef(doc.updatedAt)
  const loadedContentRef = useRef(doc.content)
  const lastDocIdRef = useRef("")
  const lastRevertKeyRef = useRef(revertKey)
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [letterWords, setLetterWords] = useState(0)
  const [title, setTitle] = useState(doc.name)
  const [cvData, setCvData] = useState<CvData>(() => cvContentOf(doc))
  const [proofData, setProofData] = useState<ProofData>(() =>
    proofContentOf(doc)
  )
  const [conflict, setConflict] = useState(false)
  const [changedSections, setChangedSections] = useState<string[]>([])
  const [selection, setSelection] = useState<CoachSelection | null>(null)
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false)
  dirtyRef.current = dirty

  function applyServerDoc(next: PaperDoc, highlight = false) {
    const previous = loadedContentRef.current
    setTitle(next.name)
    if (next.kind === "cv") {
      setCvData(cvContentOf(next))
    } else if (next.kind === "proof") {
      setProofData(proofContentOf(next))
    } else {
      const el = editorRef.current
      if (el) {
        const markdown = letterMarkdownOf(next)
        el.innerHTML = paperContentToHtml(markdown)
        setLetterWords(countWords(markdown))
      }
    }
    setDirty(false)
    setSaving(false)
    setConflict(false)
    loadedUpdatedAtRef.current = next.updatedAt
    loadedContentRef.current = next.content
    if (highlight) {
      setChangedSections(changedSectionIds(diffPaperContent(next.kind, previous, next.content)))
    } else {
      setChangedSections([])
    }
  }

  useEffect(() => {
    const switched = doc.id !== lastDocIdRef.current
    const reverted = revertKey !== lastRevertKeyRef.current
    lastDocIdRef.current = doc.id
    lastRevertKeyRef.current = revertKey
    // Reset on document switch or optimistic rollback — autosave writes
    // `doc.content` and must not wipe in-progress letter edits.
    if (switched || reverted) {
      applyServerDoc(doc)
      return
    }
    if (doc.updatedAt === loadedUpdatedAtRef.current) return
    if (dirtyRef.current) {
      setConflict(true)
      return
    }
    applyServerDoc(doc, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [doc.id, doc.updatedAt, isCv, isProof, revertKey])

  useEffect(() => {
    const root = canvasRef.current
    if (!root || changedSections.length === 0) return
    const els = changedSections
      .map((id) =>
        root.querySelector<HTMLElement>(
          `[data-paper-section="${CSS.escape(id)}"]`
        )
      )
      .filter((el): el is HTMLElement => Boolean(el))
    for (const el of els) el.classList.add("paper-coach-changed")
    const first = els[0]
    if (typeof first?.scrollIntoView === "function") {
      first.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      })
    }
    const timer = window.setTimeout(() => {
      for (const el of els) el.classList.remove("paper-coach-changed")
      setChangedSections([])
    }, 1200)
    return () => {
      window.clearTimeout(timer)
      for (const el of els) el.classList.remove("paper-coach-changed")
    }
  }, [changedSections, reduceMotion])

  useEffect(() => {
    function onSelection() {
      setSelection(readPaperSelection(canvasRef.current))
    }
    document.addEventListener("selectionchange", onSelection)
    return () => document.removeEventListener("selectionchange", onSelection)
  }, [])

  useEffect(() => {
    if (!dirty || conflict) return

    setSaving(true)
    const timer = window.setTimeout(() => {
      if (isCv) {
        onChange({
          ...doc,
          content: cvData,
        })
      } else if (isProof) {
        onChange({
          ...doc,
          content: proofData,
        })
      } else {
        const el = editorRef.current
        if (!el) return
        onChange({
          ...doc,
          content: { markdown: paperHtmlToContent(el) },
        })
      }
      setDirty(false)
      setSaving(false)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [conflict, dirty, doc, onChange, isCv, isProof, cvData, proofData])

  function handleRichInput() {
    const el = editorRef.current
    if (el) setLetterWords(countWords(el.innerText))
    setDirty(true)
  }

  function insertInEditor(text: string) {
    const el = editorRef.current
    if (!el) return
    el.focus()
    document.execCommand("insertText", false, text)
    handleRichInput()
  }

  function handleCvInsert(id: CvInsertId) {
    if (id === "photo") {
      cvPhotoRef.current?.click()
      return
    }
    const next = { ...cvData }
    switch (id) {
      case "experience":
        next.experience = [
          ...next.experience,
          {
            role: "Role title",
            company: "Company",
            period: "2024 – Present",
            bullets: ["One concrete outcome with a number…"],
          },
        ]
        break
      case "education":
        next.education = [
          ...next.education,
          {
            school: "School name",
            degree: "Degree · major",
            period: "2022 – 2026",
          },
        ]
        break
      case "skill":
        next.skills = [
          ...next.skills,
          { label: "Skills", items: ["Add skill"] },
        ]
        break
      case "project":
        next.projects = [
          ...(next.projects ?? []),
          {
            name: "Project name",
            detail: "What you shipped and what changed.",
          },
        ]
        break
      case "section":
        next.summary = `${next.summary}\n\nVolunteering / awards — add a short line here.`
        break
    }
    handleCvChange(next)
  }

  function handleCvTailor() {
    handleCvChange({
      ...cvData,
      summary: `${cvData.summary} (Tailored for target role — review bullets and Proof links.)`,
    })
  }

  function handleLetterInsert(id: LetterInsertId) {
    const blocks: Record<LetterInsertId, string> = {
      salutation: "Dear hiring team,\n\n",
      paragraph: "\n\nI am writing to apply for…\n\n",
      signoff: `\n\nBest,\n${profileFirstName({
        name: session?.user.name?.trim() || "You",
      })}\n`,
      ps: "\n\nP.S. Happy to share my checkout card Proof if helpful.\n",
    }
    insertInEditor(blocks[id])
  }

  function handleProofInsert(id: ProofInsertId) {
    if (id === "photo") {
      proofPhotoRef.current?.click()
      return
    }
    handleProofChange({
      ...proofData,
      steps: [...proofData.steps, newProofStep(id as ProofStepType)],
    })
  }

  function handleProofPhoto(file: File) {
    const photo = {
      id: `photo-${Date.now()}`,
      url: URL.createObjectURL(file),
      caption: file.name.replace(/\.[^.]+$/, ""),
    }
    if (proofData.steps.length === 0) {
      handleProofChange({
        ...proofData,
        steps: [{ ...newProofStep("note"), photos: [photo] }],
      })
      return
    }
    const lastIndex = proofData.steps.length - 1
    const steps = proofData.steps.map((s, i) =>
      i === lastIndex ? { ...s, photos: [...s.photos, photo] } : s
    )
    handleProofChange({ ...proofData, steps })
  }

  function handleCvPhoto(file: File) {
    handleCvChange({
      ...cvData,
      photoUrl: URL.createObjectURL(file),
      templateId: "photo",
    })
  }

  function handleCvChange(next: CvData) {
    setCvData(next)
    setDirty(true)
  }

  function handleProofChange(next: ProofData) {
    setProofData(next)
    setDirty(true)
  }

  function handleTemplateChange(templateId: CvTemplateId) {
    handleCvChange(applyCvTemplate(cvData, templateId))
  }

  function handleSave() {
    if (isCv) {
      onChange({
        ...doc,
        content: cvData,
      })
    } else if (isProof) {
      onChange({
        ...doc,
        content: proofData,
      })
    } else {
      const el = editorRef.current
      if (!el) return
      onChange({
        ...doc,
        content: { markdown: paperHtmlToContent(el) },
      })
    }
    setDirty(false)
    setSaving(false)
  }

  const maxWidth = isProof
    ? "max-w-[58rem]"
    : isCv
      ? "max-w-[calc(210mm+3rem)]"
      : "max-w-[46rem]"

  return (
    <div
      className="flex h-full min-h-0 bg-muted"
      role="region"
      aria-label={`Editing ${doc.name}`}
    >
      <PaperEditorSidebar
        docs={docs}
        activeId={doc.id}
        onSelect={onSelectDoc}
        onBack={onBack}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          className="items-center gap-3 px-5 py-3"
          icon={<FileText className="size-4 shrink-0 text-muted-foreground" />}
          title={
            <div className="min-w-0 flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const name = title.trim()
                  if (name && name !== doc.name) onRename(name)
                  else setTitle(doc.name)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                }}
                className="h-auto w-full truncate border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
                aria-label="Document name"
              />
              <p className="text-xs text-muted-foreground">
                {TYPE_LABEL[doc.kind]}
                {" · "}Updated {formatPaperUpdated(doc.updatedAt)}
              </p>
            </div>
          }
        >

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" size="icon-sm" variant="ghost" />}
              aria-label="More"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <StatusPill status={doc.status} onChange={onStatusChange} />

          <Button type="button" size="sm" variant="outline">
            <Share2 className="size-3.5" />
            Share
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!dirty && !saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </WorkspaceHeader>

        {conflict ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm"
          >
            <p>
              Coach updated this document while you have unsaved edits.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  loadedUpdatedAtRef.current = doc.updatedAt
                  setConflict(false)
                }}
              >
                Keep mine
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => applyServerDoc(doc, true)}
              >
                Use Coach&apos;s version
              </Button>
            </div>
          </div>
        ) : null}

        <div
          ref={canvasRef}
          data-paper-canvas
          className="min-h-0 flex-1 overflow-auto px-4 py-8 sm:px-8"
        >
          <div
            className={cn(
              "mx-auto flex w-full flex-col items-center",
              maxWidth
            )}
          >
            {isCv ? (
              <>
                {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
                <input
                  ref={cvPhotoRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCvPhoto(file)
                    e.target.value = ""
                  }}
                />
                <PaperEditorToolbar
                  variant="cv"
                  className="sticky top-0 z-10 mb-4 w-full backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
                  cvTemplateId={cvData.templateId}
                  onCvTemplateChange={handleTemplateChange}
                  onCvInsert={handleCvInsert}
                  onCvTailor={handleCvTailor}
                />
                <CvA4Canvas>
                  <CvDocument data={cvData} onChange={handleCvChange} />
                </CvA4Canvas>
              </>
            ) : isProof ? (
              <>
                {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
                <input
                  ref={proofPhotoRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleProofPhoto(file)
                    e.target.value = ""
                  }}
                />
                <PaperEditorToolbar
                  variant="proof"
                  className="mb-5 w-full"
                  proofViewMode={proofData.viewMode}
                  onProofViewModeChange={(mode) =>
                    handleProofChange({ ...proofData, viewMode: mode })
                  }
                  onProofInsert={handleProofInsert}
                />
              </>
            ) : (
              <PaperEditorToolbar
                variant={isLetter ? "letter" : "full"}
                className="mb-5 w-full"
                onLetterInsert={isLetter ? handleLetterInsert : undefined}
                letterWordCount={isLetter ? letterWords : undefined}
              />
            )}

            {!isCv ? (
              isProof ? (
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <ProofDocument
                    data={proofData}
                    onChange={handleProofChange}
                  />
                </div>
              ) : (
                <article
                  className={cn(
                    "w-full overflow-hidden rounded-xl border bg-card shadow-sm",
                    doc.status === "draft"
                      ? "border-border ring-1 ring-ring/20"
                      : "border-border/80"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium text-muted-foreground">
                        {doc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status === "draft" ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Draft
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="More"
                        className="text-muted-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    role="textbox"
                    suppressContentEditableWarning
                    onInput={handleRichInput}
                    data-paper-section="letter"
                    className="paper-editor-canvas prose-kit min-h-[70vh] px-10 py-10 outline-none sm:px-14 sm:py-12"
                    aria-label="Document content"
                    spellCheck
                  />
                </article>
              )
            ) : null}
          </div>
        </div>

        <CoachFloat
          key={doc.id}
          docId={doc.id}
          docName={doc.name}
          selection={selection}
          variant={
            isCv ? "cv" : isProof ? "proof" : isLetter ? "letter" : "full"
          }
        />
      </div>
    </div>
  )
}

function countWords(text: string | undefined) {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length
}

function StatusPill({
  status,
  onChange,
}: {
  status: PaperDocStatus
  onChange: (status: PaperDocStatus) => void
}) {
  const label =
    status === "published"
      ? "Published"
      : status === "ready"
        ? "Ready"
        : "Draft"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
          status === "published" && "border-border bg-muted text-foreground",
          status === "ready" &&
            "border-border bg-secondary text-secondary-foreground",
          status === "draft" &&
            "border-border bg-muted/40 text-muted-foreground"
        )}
        aria-label="Document status"
      >
        {status === "published" ? <Globe className="size-3.5" /> : null}
        {label}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("draft")}>
          Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("ready")}>
          Ready
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("published")}>
          Published
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
