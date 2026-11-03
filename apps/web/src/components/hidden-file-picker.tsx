import type { Ref } from "react"

export function HiddenFilePicker({
  accept,
  onFile,
  ref,
}: {
  accept: string
  onFile: (file: File) => void
  ref?: Ref<HTMLInputElement>
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onFile(file)
        event.target.value = ""
      }}
    />
  )
}
