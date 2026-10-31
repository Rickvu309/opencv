import { memo, type RefObject } from "react"

import type { PaperView } from "@workspace/domain"

type Props = {
  doc: Pick<PaperView, "name" | "status">
  editorRef: RefObject<HTMLDivElement | null>
  onInput: () => void
}

export const PaperLetterArticle = memo(function PaperLetterArticle({
  doc,
  editorRef,
  onInput,
}: Props) {
  return (
    <article
      aria-label={doc.name}
      data-slot="letter-editor-sheet"
      className="w-full max-w-[560px] shrink-0 rounded-[2px]"
    >
      <div
        ref={editorRef}
        contentEditable="plaintext-only"
        role="textbox"
        suppressContentEditableWarning
        onInput={onInput}
        data-paper-section="letter"
        className="paper-editor-canvas min-h-[792px] px-6 py-14 text-[11px] leading-[1.5] outline-none sm:px-[60px]"
        aria-label="Letter text"
        spellCheck
      />
    </article>
  )
})
