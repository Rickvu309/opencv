import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import type { CoachSelection } from "@workspace/domain"
import { changedSectionIds, diffPaperContent } from "@workspace/domain"
import { cn } from "@workspace/ui/lib/utils"
import type { PaperDocStatus } from "@workspace/domain"

import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { authClient } from "@/lib/auth-client.ts"
import { readStored, writeStored } from "@/lib/local-storage.ts"

import { applyCvTemplate } from "./paper-cv-template-picker.tsx"
import {
  addEducation,
  addExperienceRole,
  addSkillGroup,
  BLANK_PROJECT,
} from "./paper-cv-edits.ts"
import {
  absorbCvServerSnapshot,
  createCvHistory,
  isPaperRedoShortcut,
  isPaperUndoShortcut,
  pushCvChange,
  redoCv,
  shouldIgnoreCvHistoryShortcut,
  undoCv,
} from "./paper-cv-history.ts"
import { type CvData, type CvTemplateId } from "./paper-cv-types.ts"
import {
  cvContentOf,
  isSampleCv,
  letterMarkdownOf,
  ownedCvName,
  profileFirstName,
  proofContentOf,
  type PaperDoc,
} from "./paper-data.ts"
import { CoachFloat } from "./coach-float.tsx"
import {
  paperCiteSpansFromCv,
  paperCiteSpansFromLetter,
  paperCiteSpansFromProof,
} from "./paper-cite.ts"
import {
  collapsePaperSelection,
  readPaperSelection,
  retainCoachSelection,
} from "./paper-selection.ts"
import { PaperEditorConflictBanner } from "./paper-editor-conflict-banner.tsx"
import { PaperSuggestionBar } from "./paper-suggestion-bar.tsx"
import { addSuggestion, type PaperSuggestion } from "./paper-suggestion.ts"
import { useSectionFocus } from "./use-section-focus.ts"
import { useSuggestionMarks } from "./use-suggestion-marks.ts"
import { DOCS_PANEL_ID, PaperEditorHeader } from "./paper-editor-header.tsx"
import { countWords } from "./paper-editor-helpers.ts"
import { PaperCvSurface } from "./paper-cv-surface.tsx"
import { PaperLetterArticle } from "./paper-letter-article.tsx"
import { PaperProofToolbar } from "./paper-proof-toolbar.tsx"
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

const DOCS_PANEL_KEY = "opencv:paper:docs-panel"

type DocsPanelState = "expanded" | "collapsed"

function parseDocsPanel(raw: string | null): DocsPanelState {
  return raw === "collapsed" ? "collapsed" : "expanded"
}

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
  const [cvHistory, setCvHistory] = useState(() =>
    createCvHistory(cvContentOf(doc))
  )
  const cvData = cvHistory.present
  const [proofData, setProofData] = useState<ProofData>(() =>
    proofContentOf(doc)
  )
  const cvHistoryRef = useRef(cvHistory)
  const cvDataRef = useRef(cvData)
  const proofDataRef = useRef(proofData)
  const docRef = useRef(doc)
  const onChangeRef = useRef(onChange)
  const onRenameRef = useRef(onRename)
  const isCvRef = useRef(isCv)
  const isProofRef = useRef(isProof)
  const titleRef = useRef(title)
  const userNameRef = useRef(session?.user.name)
  const [conflict, setConflict] = useState(false)
  const { focusSections, clearSectionFocus } = useSectionFocus(canvasRef)
  const [suggestion, setSuggestion] = useState<PaperSuggestion | null>(null)
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null)
  const [coachDocked, setCoachDocked] = useState(false)
  useSuggestionMarks(canvasRef, suggestion?.sectionIds)
  const [selection, setSelection] = useState<CoachSelection | null>(null)
  const [docsPanel, setDocsPanel] = useState<DocsPanelState>(() =>
    readStored(DOCS_PANEL_KEY, parseDocsPanel, "expanded")
  )
  const [phoneDocsOpen, setPhoneDocsOpen] = useState(false)
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const overlayDocs = !isDesktop || coachDocked
  const docsExpanded = overlayDocs ? phoneDocsOpen : docsPanel === "expanded"

  useEffect(() => {
    cvHistoryRef.current = cvHistory
    cvDataRef.current = cvData
    proofDataRef.current = proofData
    docRef.current = doc
    onChangeRef.current = onChange
    onRenameRef.current = onRename
    isCvRef.current = isCv
    isProofRef.current = isProof
    titleRef.current = title
    userNameRef.current = session?.user.name
    dirtyRef.current = dirty
  })

  function toggleDocsPanel() {
    if (overlayDocs) {
      setPhoneDocsOpen((open) => !open)
      return
    }
    const next: DocsPanelState = docsExpanded ? "collapsed" : "expanded"
    setDocsPanel(next)
    writeStored(DOCS_PANEL_KEY, next)
  }

  function applyServerDoc(next: PaperDoc, highlight = false) {
    const previous = loadedContentRef.current
    setTitle(next.name)
    if (next.kind === "cv") {
      const nextHistory = absorbCvServerSnapshot(
        cvHistoryRef.current,
        cvContentOf(next)
      )
      cvHistoryRef.current = nextHistory
      cvDataRef.current = nextHistory.present
      setCvHistory(nextHistory)
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
      const hunks = diffPaperContent(next.kind, previous, next.content)
      focusSections(changedSectionIds(hunks))
      setSuggestion((current) => addSuggestion(current, previous, hunks))
    } else {
      clearSectionFocus()
    }
  }

  function keepSuggestion() {
    setSuggestion(null)
  }

  function undoSuggestion() {
    if (!suggestion) return
    const restored = { ...docRef.current, content: suggestion.previous }
    setSuggestion(null)
    applyServerDoc(restored as PaperDoc)
    onChangeRef.current(restored as PaperDoc)
  }

  const syncServerDoc = useEffectEvent(() => {
    const switched = doc.id !== lastDocIdRef.current
    const reverted = revertKey !== lastRevertKeyRef.current
    lastDocIdRef.current = doc.id
    lastRevertKeyRef.current = revertKey
    // Reset on document switch or optimistic rollback — autosave writes
    // `doc.content` and must not wipe in-progress letter edits.
    if (switched || reverted) {
      applyServerDoc(doc)
      setSelection(null)
      setSuggestion(null)
      return
    }
    if (doc.updatedAt === loadedUpdatedAtRef.current) return
    if (dirtyRef.current) {
      setConflict(true)
      return
    }
    applyServerDoc(doc, true)
  })

  useEffect(() => {
    syncServerDoc()
  }, [doc.id, doc.updatedAt, isCv, isProof, revertKey])

  useEffect(() => {
    function onSelection() {
      const next = readPaperSelection(canvasRef.current)
      setSelection((prev) => retainCoachSelection(prev, next))
    }
    document.addEventListener("selectionchange", onSelection)
    return () => document.removeEventListener("selectionchange", onSelection)
  }, [])

  const highlightPaperCite = useCallback(
    (sectionId: string) => focusSections([sectionId]),
    [focusSections]
  )

  useEffect(() => {
    if (dirty) setSuggestion(null)
  }, [dirty])

  const citeSpans = useMemo(() => {
    if (isCv) return paperCiteSpansFromCv(cvData)
    if (isProof) return paperCiteSpansFromProof(proofData)
    if (isLetter) return paperCiteSpansFromLetter(letterMarkdownOf(doc))
    return []
  }, [cvData, doc, isCv, isLetter, isProof, proofData])

  const clearCoachSelection = useCallback(() => {
    setSelection(null)
    collapsePaperSelection(canvasRef.current)
  }, [])

  function claimSampleCv(personName?: string) {
    const current = docRef.current
    if (!isSampleCv(current)) return
    const typed = titleRef.current.trim()
    if (typed && typed !== current.name) return
    const name = ownedCvName(userNameRef.current, personName)
    setTitle(name)
    titleRef.current = name
    onRenameRef.current(name)
  }

  function persistOpenDoc() {
    const current = docRef.current
    if (isCvRef.current) {
      const content = cvDataRef.current
      loadedContentRef.current = content
      onChangeRef.current({
        ...current,
        content,
      })
      claimSampleCv(content.name)
      return
    }
    if (isProofRef.current) {
      const content = proofDataRef.current
      loadedContentRef.current = content
      onChangeRef.current({
        ...current,
        content,
      })
      return
    }
    const el = editorRef.current
    if (!el) return
    const content = { markdown: paperHtmlToContent(el) }
    loadedContentRef.current = content
    onChangeRef.current({
      ...current,
      content,
    })
  }

  const persistOpenDocInEffect = useEffectEvent(persistOpenDoc)

  useEffect(() => {
    if (!dirty || conflict) return

    setSaving(true)
    const timer = window.setTimeout(() => {
      persistOpenDocInEffect()
      setDirty(false)
      setSaving(false)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [conflict, dirty, isCv, isProof, cvData, proofData])

  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return
      persistOpenDocInEffect()
    }
  }, [])

  useEffect(() => {
    if (!isCv) return
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreCvHistoryShortcut(event.target)) return
      if (isPaperUndoShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        applyCvUndo()
        return
      }
      if (isPaperRedoShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        applyCvRedo()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [isCv])

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
        next.experience = addExperienceRole(next.experience)
        break
      case "education":
        next.education = addEducation(next.education)
        break
      case "skill":
        next.skills = addSkillGroup(next.skills)
        break
      case "project":
        next.projects = [...(next.projects ?? []), BLANK_PROJECT]
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
    const nextHistory = pushCvChange(cvHistoryRef.current, next)
    cvHistoryRef.current = nextHistory
    cvDataRef.current = nextHistory.present
    setCvHistory(nextHistory)
    setDirty(true)
  }

  function applyCvUndo() {
    const nextHistory = undoCv(cvHistoryRef.current)
    if (!nextHistory) return
    cvHistoryRef.current = nextHistory
    cvDataRef.current = nextHistory.present
    setCvHistory(nextHistory)
    setDirty(true)
  }

  function applyCvRedo() {
    const nextHistory = redoCv(cvHistoryRef.current)
    if (!nextHistory) return
    cvHistoryRef.current = nextHistory
    cvDataRef.current = nextHistory.present
    setCvHistory(nextHistory)
    setDirty(true)
  }

  function handleProofChange(next: ProofData) {
    proofDataRef.current = next
    setProofData(next)
    setDirty(true)
  }

  function handleTemplateChange(templateId: CvTemplateId) {
    handleCvChange(applyCvTemplate(cvData, templateId))
  }

  function handleSave() {
    persistOpenDoc()
    setDirty(false)
    setSaving(false)
  }

  function makeMine() {
    if (dirtyRef.current) {
      persistOpenDoc()
      setDirty(false)
      setSaving(false)
      return
    }
    const current = docRef.current
    if (!isSampleCv(current)) return
    const name = ownedCvName(userNameRef.current, cvDataRef.current.name)
    setTitle(name)
    titleRef.current = name
    onRenameRef.current(name)
  }

  const maxWidth = isProof
    ? "max-w-[58rem]"
    : isCv
      ? "max-w-[calc(210mm+3rem)]"
      : "max-w-[46rem]"

  return (
    <div
      className="relative flex h-full min-h-0 bg-muted"
      role="region"
      aria-label={`Editing ${doc.name}`}
    >
      {docsExpanded ? (
        <PaperEditorSidebar
          id={DOCS_PANEL_ID}
          docs={docs}
          activeId={doc.id}
          onSelect={onSelectDoc}
          onBack={onBack}
          overlay={overlayDocs}
        />
      ) : null}

      <div data-paper-editor="" className="flex min-w-0 flex-1 flex-col">
        <PaperEditorHeader
          doc={doc}
          title={title}
          onTitleChange={setTitle}
          onRename={onRename}
          docsExpanded={docsExpanded}
          onToggleDocs={toggleDocsPanel}
          onMakeMine={makeMine}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
        />

        {conflict ? (
          <PaperEditorConflictBanner
            kind={doc.kind}
            onKeepMine={() => {
              loadedUpdatedAtRef.current = doc.updatedAt
              setConflict(false)
            }}
            onUseServer={() => {
              applyServerDoc(doc, true)
              setSuggestion(null)
            }}
          />
        ) : null}

        {suggestion && !conflict ? (
          <PaperSuggestionBar
            suggestion={suggestion}
            onKeep={keepSuggestion}
            onUndo={undoSuggestion}
          />
        ) : null}

        <div
          ref={canvasRef}
          data-paper-canvas
          className="paper-editor-canvas-scroll min-h-0 flex-1 overflow-auto px-4 py-8 sm:px-8"
        >
          <div
            className={cn(
              "mx-auto flex w-full flex-col items-center",
              maxWidth
            )}
          >
            {isCv ? (
              <PaperCvSurface
                photoRef={cvPhotoRef}
                onPhoto={handleCvPhoto}
                cvData={cvData}
                cvHistory={cvHistory}
                onTemplateChange={handleTemplateChange}
                onInsert={handleCvInsert}
                onTailor={handleCvTailor}
                onUndo={applyCvUndo}
                onRedo={applyCvRedo}
                onChange={handleCvChange}
              />
            ) : isProof ? (
              <PaperProofToolbar
                photoRef={proofPhotoRef}
                onPhoto={handleProofPhoto}
                proofData={proofData}
                onChange={handleProofChange}
                onInsert={handleProofInsert}
              />
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
                <PaperLetterArticle
                  doc={doc}
                  editorRef={editorRef}
                  onInput={handleRichInput}
                />
              )
            ) : null}
          </div>
        </div>

        <CoachFloat
          key={doc.id}
          dock={dockEl}
          onDockedChange={setCoachDocked}
          docId={doc.id}
          docName={doc.name}
          selection={selection}
          onClearSelection={clearCoachSelection}
          citeSpans={citeSpans}
          onCitePaper={highlightPaperCite}
          variant={
            isCv ? "cv" : isProof ? "proof" : isLetter ? "letter" : "full"
          }
        />
      </div>
      <div ref={setDockEl} className="flex h-full shrink-0" />
    </div>
  )
}
