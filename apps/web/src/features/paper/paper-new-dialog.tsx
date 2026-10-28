import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

import {
  blankBlockDocument,
  type PaperTemplateId,
  type PaperView,
} from "@workspace/domain"

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
  const [error, setError] = useState<string | null>(null)

  async function applyTemplate(templateId?: PaperTemplateId) {
    setPending(true)
    setError(null)
    try {
      const created = await run("paper.create", {
        kind: "cv",
        templateId,
        document: blankBlockDocument(),
      })
      onCreated(created)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create this CV. Try again."
      )
    } finally {
      setPending(false)
    }
  }

  if (step === "gallery") {
    return (
      <div className="space-y-3">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <PaperTemplateGallery
          onUse={(templateId) => void applyTemplate(templateId)}
          onImport={onImport}
          onBlank={() => void applyTemplate()}
          pending={pending}
        />
      </div>
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
