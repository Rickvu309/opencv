import type { ComponentProps } from "react"

import { PaperImportRow } from "./paper-import.tsx"
import { NewPaperCard } from "./paper-parts.tsx"

type Props = ComponentProps<typeof PaperImportRow> & {
  onStartCv: () => void
  onStartLetter: () => void
}

export function PaperFirstRun({
  onStartCv,
  onStartLetter,
  ...importProps
}: Props) {
  return (
    <div className="flex min-h-fit flex-1 flex-col items-center justify-center px-6 py-10 md:pt-0 md:pb-14">
      <div className="text-center">
        <h2 className="text-2xl leading-7 font-semibold">Start a document</h2>
        <p className="pt-2 text-sm text-muted-foreground/85">
          Pick a page, or bring a file you already have.
        </p>
      </div>
      <div className="flex w-full max-w-170 flex-wrap justify-center gap-10 py-10">
        <NewPaperCard title="CV" kind="cv" onClick={onStartCv} />
        <NewPaperCard
          title="Cover letter"
          kind="letter"
          onClick={onStartLetter}
        />
        <NewPaperCard title="Proof" kind="proof" href="/proof" />
      </div>
      <PaperImportRow {...importProps} />
    </div>
  )
}
