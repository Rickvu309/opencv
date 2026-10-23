import type { RefObject } from "react"

import {
  PaperEditorToolbar,
  type ProofInsertId,
} from "./paper-editor-toolbar.tsx"
import type { ProofData } from "./paper-proof-types.ts"

type Props = {
  photoRef: RefObject<HTMLInputElement | null>
  onPhoto: (file: File) => void
  proofData: ProofData
  onChange: (next: ProofData) => void
  onInsert: (id: ProofInsertId) => void
}

export function PaperProofToolbar({
  photoRef,
  onPhoto,
  proofData,
  onChange,
  onInsert,
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
        variant="proof"
        className="mb-5 w-full"
        proofViewMode={proofData.viewMode}
        onProofViewModeChange={(mode) =>
          onChange({ ...proofData, viewMode: mode })
        }
        onProofInsert={onInsert}
      />
    </>
  )
}
