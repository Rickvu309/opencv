import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

import type { PaperTemplateId, PaperView } from "@workspace/domain"

import { useRunCommand } from "@/lib/contract-client.ts"

import { PaperTemplateGallery } from "./paper-template-gallery.tsx"

export function PaperNewDialog({
  step,
  onStepChange,
  onCreated,
  onChooseLetter,
  onImport,
}: {
  step: "kind" | "gallery"
  onStepChange: (step: "kind" | "gallery") => void
  onCreated: (doc: PaperView) => void
  onChooseLetter: () => void
  onImport: () => void
}) {
  const run = useRunCommand()
  const [pending, setPending] = useState(false)

  async function applyTemplate(templateId: PaperTemplateId) {
    setPending(true)
    try {
      const created = await run("paper.create", { kind: "cv", templateId })
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
        onClick={() => onStepChange("gallery")}
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
