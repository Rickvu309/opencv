import type { RefObject } from "react"

import { Button } from "@workspace/ui/components/button"

import type { ProofData } from "./paper-proof-types.ts"

type Props = {
  photoRef: RefObject<HTMLInputElement | null>
  onPhoto: (file: File) => void
  proofData: ProofData
  onChange: (next: ProofData) => void
  onInsert: (id: "photo") => void
}

export function PaperProofToolbar({
  photoRef,
  onPhoto,
  proofData,
  onChange,
  onInsert,
}: Props) {
  return (
    <div data-proof-toolbar={proofData.viewMode}>
      {/* Documented exception: native file input. Kit Input cannot host a hidden file picker. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPhoto(file)
          event.target.value = ""
        }}
      />
      <Button type="button" variant="ghost" onClick={() => onInsert("photo")}>
        Add photo
      </Button>
      <Button type="button" variant="ghost" onClick={() => onChange(proofData)}>
        Keep proof
      </Button>
    </div>
  )
}
