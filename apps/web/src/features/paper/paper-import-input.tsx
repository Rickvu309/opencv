import type { RefObject } from "react"

import { HiddenFilePicker } from "@/components/hidden-file-picker.tsx"

export function PaperImportInput({
  inputRef,
  accept,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  accept: string
  onFile: (file: File) => void
}) {
  return <HiddenFilePicker ref={inputRef} accept={accept} onFile={onFile} />
}
