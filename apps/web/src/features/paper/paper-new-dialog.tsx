import { useReducer } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"

import { type PaperTemplateId } from "@workspace/domain"

import { catalogClient, useRunCommand } from "@/lib/contract-client.ts"

import {
  PaperTemplateGallery,
  type PickerChoice,
} from "./paper-template-gallery.tsx"

export async function openBlankPage(
  queryClient: QueryClient,
  kind: "cv" | "letter"
) {
  const created = await catalogClient.run(queryClient, "paper.create", {
    kind,
    format: "rich",
  })
  if ("pending" in created)
    throw new Error("Could not create this Paper. Try again.")
  return created.id
}

export async function openTemplatePage(
  run: ReturnType<typeof useRunCommand>,
  templateId: PaperTemplateId
) {
  const created = await run("paper.canvas", {
    op: "mint",
    label: "cv",
    templateId,
  })
  return created.docId
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
  initial,
  kind = "cv",
  onCoach,
  onMinted,
  onChooseLetter,
  onImport,
}: {
  step: "kind" | "gallery"
  initial?: PickerChoice
  kind?: "cv" | "letter"
  onCoach?: () => void
  onStepChange: (step: "kind" | "gallery") => void
  onMinted: (docId: string) => void
  onChooseLetter: () => void
  onImport: () => void
}) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const [{ pending, error }, dispatch] = useReducer(createReducer, {
    pending: false,
    error: null,
  })

  async function applyTemplate(templateId: PaperTemplateId) {
    dispatch({ type: "create_started" })
    try {
      onMinted(await openTemplatePage(run, templateId))
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
      onMinted(await openBlankPage(queryClient, kind))
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
      <PaperTemplateGallery
        title={kind === "cv" ? "New CV" : "New Letter"}
        description={
          kind === "cv"
            ? "Choose a starting point for your CV."
            : "Start with a blank page or draft with Coach."
        }
        kind={kind}
        initial={initial}
        onCoach={onCoach}
        onUse={(templateId) => void applyTemplate(templateId)}
        onImport={onImport}
        onBlank={() => void startBlank()}
        pending={pending}
        error={error}
      />
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
