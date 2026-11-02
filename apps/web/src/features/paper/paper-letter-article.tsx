import { memo } from "react"

import type { LetterDocument, PaperView } from "@workspace/domain"

import { LetterSheet } from "./letter-sheet.tsx"

type Props = {
  doc: Pick<PaperView, "name" | "status">
  letter: LetterDocument
  onChange: (letter: LetterDocument) => void
}

export const PaperLetterArticle = memo(function PaperLetterArticle({
  doc,
  letter,
  onChange,
}: Props) {
  return (
    <article
      aria-label={doc.name}
      data-slot="letter-editor-sheet"
      className="w-full max-w-[560px] shrink-0 rounded-[2px]"
    >
      <div
        data-paper-section="letter"
        className="paper-editor-canvas flex justify-center overflow-x-auto"
      >
        <LetterSheet letter={letter} mode="edit" onChange={onChange} />
      </div>
    </article>
  )
})
