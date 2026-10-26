import type { RefObject } from "react"

import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { CvDocument } from "./paper-cv-document.tsx"
import type { CvData } from "./paper-cv-types.ts"

type SurfaceProps = {
  data: CvData
  onChange: (next: CvData) => void
}

export function PaperCvSurface({ data, onChange }: SurfaceProps) {
  return (
    <CvA4Canvas>
      <CvDocument data={data} onChange={onChange} />
    </CvA4Canvas>
  )
}

export function PaperImportInput({
  inputRef,
  accept,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  accept: string
  onFile: (file: File) => void
}) {
  return (
    <>
      {/* Documented exception: native file input. Kit Input cannot host a hidden file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ""
        }}
      />
    </>
  )
}
