import { useReducer } from "react"

import { Button } from "@workspace/ui/components/button"

import { type PaperTemplateId, type PaperView } from "@workspace/domain"

import { useRunCommand } from "@/lib/contract-client.ts"

import { PaperTemplateGallery } from "./paper-template-gallery.tsx"

const SAVED_WORDS_UNAVAILABLE = "Saved Word documents are unavailable."

export async function openBlankPage(run: ReturnType<typeof useRunCommand>) {
  try {
    const created = await run("paper.canvas", { op: "mint" })
    if (
      created &&
      typeof created === "object" &&
      "docId" in created &&
      typeof created.docId === "string"
    ) {
      return { minted: true as const, id: created.docId }
    }
    throw new Error("Could not start a blank page. Try again.")
  } catch (cause) {
    if (
      !(cause instanceof Error) ||
      cause.message !== SAVED_WORDS_UNAVAILABLE
    ) {
      throw cause
    }
  }
  const created = await run("paper.create", { kind: "cv" })
  return { minted: false as const, doc: created }
}

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
  onMinted,
  onChooseLetter,
  onImport,
}: {
  step: "kind" | "gallery"
  onStepChange: (step: "kind" | "gallery") => void
  onCreated: (doc: PaperView) => void
  onMinted?: (docId: string) => void
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

  async function startBlank() {
    dispatch({ type: "create_started" })
    try {
      const opened = await openBlankPage(run)
      if (opened.minted) onMinted?.(opened.id)
      else onCreated(opened.doc)
    } catch (cause) {
      dispatch({
        type: "create_failed",
        message:
          cause instanceof Error
            ? cause.message
            : "Could not start a blank page. Try again.",
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
          onBlank={() => void startBlank()}
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
        className="h-auto min-h-11 justify-start whitespace-normal md:min-h-0"
        onClick={() => onStepChange("gallery")}
        disabled={pending}
      >
        CV
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-11 justify-start whitespace-normal md:min-h-0"
        onClick={onChooseLetter}
      >
        Cover letter
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-11 justify-start whitespace-normal md:min-h-0"
        onClick={onImport}
      >
        Import a file
      </Button>
    </div>
  )
}
