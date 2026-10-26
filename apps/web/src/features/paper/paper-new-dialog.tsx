import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"

import { createPaper, type PaperRecord } from "./paper-api.ts"
import { PaperTemplateGallery } from "./paper-template-gallery.tsx"

export function PaperNewDialog({
  initialStep = "kind",
  onCreated,
  onChooseLetter,
  onImport,
}: {
  initialStep?: "kind" | "gallery"
  onCreated: (doc: PaperRecord) => void
  onChooseLetter: () => void
  onImport: () => void
}) {
  const [step, setStep] = useState(initialStep)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setStep(initialStep)
  }, [initialStep])

  async function applyTemplate(templateId: string) {
    setPending(true)
    try {
      const created = await createPaper({ kind: "cv", templateId })
      onCreated(created)
    } finally {
      setPending(false)
    }
  }

  if (step === "gallery") {
    return (
      <PaperTemplateGallery
        onUse={(templateId) => void applyTemplate(templateId)}
        onImport={onImport}
      />
    )
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-auto justify-start whitespace-normal"
        onClick={() => setStep("gallery")}
        disabled={pending}
      >
        CV
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto justify-start whitespace-normal"
        onClick={onChooseLetter}
      >
        Cover letter
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto justify-start whitespace-normal"
        onClick={onImport}
      >
        Import a file
      </Button>
    </div>
  )
}
