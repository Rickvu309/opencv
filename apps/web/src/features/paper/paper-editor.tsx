import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
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

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"

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
  const isCv = doc.kind === "cv"
  const isProof = doc.kind === "proof"
  const isLetter = doc.kind === "letter"
  const editorRef = useRef<HTMLDivElement>(null)
  const proofPhotoRef = useRef<HTMLInputElement>(null)
  const cvPhotoRef = useRef<HTMLInputElement>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [letterWords, setLetterWords] = useState(0)
  const [title, setTitle] = useState(doc.name)
  const [cvData, setCvData] = useState<CvData>(() => cvContentOf(doc))
  const [proofData, setProofData] = useState<ProofData>(() =>
    proofContentOf(doc)
  )

  useEffect(() => {
    setTitle(doc.name)
    if (isCv) {
      setCvData(cvContentOf(doc))
      setDirty(false)
      setSaving(false)
      return
    }
    if (isProof) {
      setProofData(proofContentOf(doc))
      setDirty(false)
      setSaving(false)
      return
    }
    const el = editorRef.current
    if (!el) return
    const markdown = letterMarkdownOf(doc)
    el.innerHTML = paperContentToHtml(markdown)
    setLetterWords(countWords(markdown))
    setDirty(false)
    setSaving(false)
    // Reset on document switch or optimistic rollback — autosave writes
    // `doc.content` and must not wipe in-progress letter edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [doc.id, isCv, isProof, revertKey])

  useEffect(() => {
    if (!dirty) return

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
  }, [dirty, doc, onChange, isCv, isProof, cvData, proofData])

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
      signoff: `\n\nBest,\n${profileFirstName(SAMPLE_AUTHOR)}\n`,
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
      className="flex h-full min-h-0 bg-[#F3F4F6]"
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
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-5 py-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <input
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
              className="w-full truncate border-0 bg-transparent text-sm font-semibold outline-none"
              aria-label="Document name"
            />
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[doc.kind]}
              {" · "}Updated {formatPaperUpdated(doc.updatedAt)}
            </p>
          </div>

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
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-8 sm:px-8">
          <div
            className={cn(
              "mx-auto flex w-full flex-col items-center",
              maxWidth
            )}
          >
            {isCv ? (
              <>
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
                  contextLabel={doc.name}
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
                  contextLabel={doc.name}
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
                contextLabel={doc.name}
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
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Draft
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label="More"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    role="textbox"
                    suppressContentEditableWarning
                    onInput={handleRichInput}
                    className="paper-editor-canvas min-h-[70vh] px-10 py-10 text-[15px] leading-8 outline-none sm:px-14 sm:py-12"
                    aria-label="Document content"
                    spellCheck
                  />
                </article>
              )
            ) : null}
          </div>
        </div>
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
