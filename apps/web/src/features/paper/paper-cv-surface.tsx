import type { RefObject } from "react"

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
