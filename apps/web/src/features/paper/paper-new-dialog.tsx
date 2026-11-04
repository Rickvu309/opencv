import { useReducer } from "react"

import { Button } from "@workspace/ui/components/button"

import { type PaperTemplateId, type PaperView } from "@workspace/domain"

import { useRunCommand } from "@/lib/contract-client.ts"

import { PaperTemplateGallery } from "./paper-template-gallery.tsx"

type CreateState = { pending: boolean; error: string | null }

type CreateAction =
  | { type: "create_started" }
  | { type: "create_failed"; message: string }
  | { type: "create_settled" }

function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case "create_started":
      return { pending: true, error: null }
    case "create_failed":
      return { ...state, error: action.message }
    case "create_settled":
      return { ...state, pending: false }
  }
}

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
  const [{ pending, error }, dispatch] = useReducer(createReducer, {
    pending: false,
    error: null,
  })

  async function applyTemplate(templateId?: PaperTemplateId) {
    dispatch({ type: "create_started" })
    try {
      const created = await run("paper.create", {
        kind: "cv",
        templateId,
      })
      onCreated(created)
    } catch (cause) {
      dispatch({
        type: "create_failed",
        message:
          cause instanceof Error
            ? cause.message
            : "Could not create this CV. Try again.",
      })
    } finally {
      dispatch({ type: "create_settled" })
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
