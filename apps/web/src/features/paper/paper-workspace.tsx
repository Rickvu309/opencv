/**
 * Paper drive + document editor. Mounts through the Paper route seam.
 */
import { useEffect, useMemo, useState } from "react"
import {
  STARTER_CV_NAME,
  type PaperContentKind,
  type PaperDoc,
} from "@workspace/domain"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { useApplyCards } from "@/features/apply/use-apply-cards.ts"
import { authClient } from "@/lib/auth-client.ts"

import { paperAttachPair } from "./paper-apply-attach.ts"
import {
  TYPE_LABEL,
  cvContentOf,
  isSampleCv,
  ownedCvName,
  paperZeroStates,
  type PaperZeroStateId,
} from "./paper-data.ts"
import { PaperDialogs } from "./paper-dialogs.tsx"
import { PaperDrive } from "./paper-drive.tsx"
import { PaperEditor } from "./paper-editor.tsx"
import { usePaperDocs } from "./use-paper-docs.ts"

export function PaperWorkspace({
  openSample = false,
}: {
  openSample?: boolean
}) {
  const paper = usePaperDocs()
  const apply = useApplyCards()
  const { data: session } = authClient.useSession()
  const [query, setQuery] = useState("")
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openedSample, setOpenedSample] = useState(false)
  const [renameTarget, setRenameTarget] = useState<PaperDoc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaperDoc | null>(null)
  const [linkTarget, setLinkTarget] = useState<PaperDoc | null>(null)

  const openDoc = openDocId
    ? (paper.docs.find((doc) => doc.id === openDocId) ?? null)
    : null

  useEffect(() => {
    if (!openSample || openedSample || paper.isLoading) return
    const sample = paper.docs.find((doc) => doc.name === STARTER_CV_NAME)
    if (!sample) {
      setOpenedSample(true)
      return
    }
    setOpenDocId(sample.id)
    setOpenedSample(true)
  }, [openSample, openedSample, paper.docs, paper.isLoading])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return paper.docs
    return paper.docs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        TYPE_LABEL[d.kind].toLowerCase().includes(q)
    )
  }, [paper.docs, query])

  const attachPair = paperAttachPair(paper.docs, apply.cards)
  const zeroStates = paperZeroStates(paper.docs, Boolean(attachPair))

  async function handleCreate(kind: PaperContentKind) {
    const created = await paper.createDoc(kind)
    setOpenDocId(created.id)
  }

  function handleZeroState(id: PaperZeroStateId) {
    if (id === "linked") {
      if (attachPair) paper.linkApplyCard(attachPair.doc.id, attachPair.card.id)
      return
    }
    void handleCreate(id)
  }

  function makeMine(doc: PaperDoc) {
    if (!isSampleCv(doc)) return
    paper.renameDoc(
      doc.id,
      ownedCvName(session?.user.name, cvContentOf(doc).name)
    )
  }

  function submitRename(value: string) {
    const name = value.trim()
    if (renameTarget && name && name !== renameTarget.name) {
      paper.renameDoc(renameTarget.id, name)
    }
    setRenameTarget(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (openDocId === id) setOpenDocId(null)
    await paper.deleteDoc(id)
  }

  function submitLink(cardId: string | null) {
    if (linkTarget) paper.linkApplyCard(linkTarget.id, cardId)
    setLinkTarget(null)
  }

  const errorBanner = paper.error ? (
    <ErrorBanner>{paper.error}</ErrorBanner>
  ) : null

  const dialogs = (
    <PaperDialogs
      renameTarget={renameTarget}
      onRename={submitRename}
      onCloseRename={() => setRenameTarget(null)}
      deleteTarget={deleteTarget}
      onConfirmDelete={() => void confirmDelete()}
      onCloseDelete={() => setDeleteTarget(null)}
      linkTarget={linkTarget}
      cards={apply.cards}
      onLink={submitLink}
      onCloseLink={() => setLinkTarget(null)}
    />
  )

  if (openDoc) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col">
          {errorBanner}
          <div className="min-h-0 flex-1">
            <PaperEditor
              doc={openDoc}
              docs={paper.docs}
              revertKey={paper.revertKey}
              onBack={() => setOpenDocId(null)}
              onSelectDoc={setOpenDocId}
              onChange={paper.updateContent}
              onRename={(name) => paper.renameDoc(openDoc.id, name)}
              onStatusChange={(status) => paper.setStatus(openDoc.id, status)}
              onDelete={() => setDeleteTarget(openDoc)}
            />
          </div>
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-sidebar"
      role="region"
      aria-label="Paper"
    >
      {errorBanner}
      <PaperDrive
        docs={filtered}
        isLoading={paper.isLoading}
        loadFailed={paper.loadFailed}
        onReload={paper.reload}
        creating={paper.creating}
        query={query}
        onQuery={setQuery}
        companyOf={(doc) =>
          apply.cards.find((card) => card.id === doc.applyCardId)?.company
        }
        zeroStates={zeroStates}
        onZeroState={handleZeroState}
        onCreate={(kind) => void handleCreate(kind)}
        onOpen={setOpenDocId}
        rowActions={(doc) => ({
          onMakeMine: () => makeMine(doc),
          onRename: () => setRenameTarget(doc),
          onStatus: (status) => paper.setStatus(doc.id, status),
          onLink: () => setLinkTarget(doc),
          onDelete: () => setDeleteTarget(doc),
        })}
      />
      {dialogs}
    </div>
  )
}
