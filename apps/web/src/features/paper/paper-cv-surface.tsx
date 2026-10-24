import type { RefObject } from "react"

import { canRedoCv, canUndoCv, type CvHistory } from "./paper-cv-history.ts"
import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { CvDocument } from "./paper-cv-document.tsx"
import type { CvData, CvTemplateId } from "./paper-cv-types.ts"
import { PaperEditorToolbar, type CvInsertId } from "./paper-editor-toolbar.tsx"

type Props = {
  photoRef: RefObject<HTMLInputElement | null>
  onPhoto: (file: File) => void
  cvData: CvData
  cvHistory: CvHistory
  onTemplateChange: (templateId: CvTemplateId) => void
  onInsert: (id: CvInsertId) => void
  onTailor: () => void
  onUndo: () => void
  onRedo: () => void
  onChange: (next: CvData) => void
}

export function PaperCvSurface({
  photoRef,
  onPhoto,
  cvData,
  cvHistory,
  onTemplateChange,
  onInsert,
  onTailor,
  onUndo,
  onRedo,
  onChange,
}: Props) {
  return (
    <>
      {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPhoto(file)
          e.target.value = ""
        }}
      />
      <PaperEditorToolbar
        variant="cv"
        className="sticky top-0 z-10 mb-4 w-full backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
        cvTemplateId={cvData.templateId}
        onCvTemplateChange={onTemplateChange}
        onCvInsert={onInsert}
        onCvTailor={onTailor}
        canUndo={canUndoCv(cvHistory)}
        canRedo={canRedoCv(cvHistory)}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <CvA4Canvas>
        <CvDocument
          data={cvData}
          onChange={onChange}
          historyRevision={cvHistory.revision}
        />
      </CvA4Canvas>
    </>
  )
}
