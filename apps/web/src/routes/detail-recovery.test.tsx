import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as applyApi from "@/features/apply/apply-api.ts"
import * as paperQualification from "@/lib/paper-qualification.ts"
import { ApiError } from "@/lib/api-error.ts"
import { renderApp } from "@/test/render-app.tsx"

const missingId = "00000000-0000-7000-8000-000000000000"

describe("detail recovery", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([
    { path: "paper", message: "Document not found.", back: "Paper" },
    { path: "apply", message: "Job not found.", back: "Apply" },
  ])(
    "returns from a missing $path record to its collection",
    async ({ path, message, back }) => {
      const { router } = renderApp(`/${path}/${missingId}`)

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.queryByText(/Refresh the page/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Refresh" })
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: back, exact: true }))

      await waitFor(() =>
        expect(router.state.location.pathname).toBe(`/${path}`)
      )
    }
  )

  it.each([
    { status: 500, code: "INTERNAL" },
    { status: 403, code: "FORBIDDEN" },
  ])(
    "keeps a $status failure distinct from a missing record",
    async ({ status, code }) => {
      vi.spyOn(paperQualification, "qualifiedPaperRead").mockRejectedValue(
        new ApiError(status, code, "Request failed")
      )
      renderApp(`/paper/${missingId}`)

      expect(
        await screen.findByText("Could not open this document.")
      ).toBeInTheDocument()
      expect(screen.queryByText("Document not found.")).not.toBeInTheDocument()
    }
  )

  it("keeps temporary job failures retryable", async () => {
    const getJob = vi
      .spyOn(applyApi, "getJob")
      .mockRejectedValue(new ApiError(500, "INTERNAL", "Request failed"))
    renderApp(`/apply/${missingId}`)

    expect(
      await screen.findByText("Could not load jobs. Refresh the page.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Job not found.")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(getJob).toHaveBeenCalledTimes(2))
  })
})
