import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { WordBatchPreview } from "./word-batch-preview.tsx"

afterEach(cleanup)

describe("Word proposal additions", () => {
  it("shows an added line without deleting an empty placeholder", () => {
    const { container } = render(
      <WordBatchPreview
        batch={{
          state: "ready",
          changes: [
            {
              op: "setText",
              before: "",
              after: "Helped customers resolve requests.",
            },
          ],
        }}
      />
    )
    expect(screen.getByText("Add a line")).toBeVisible()
    expect(screen.getByText("Add")).toBeVisible()
    expect(container.querySelector("del")).toBeNull()
    expect(screen.queryByText("Before")).not.toBeInTheDocument()
    expect(screen.queryByText("(empty line)")).not.toBeInTheDocument()
    expect(
      screen.getByText("Helped customers resolve requests.").closest("ins")
    ).not.toBeNull()
  })

  it("keeps the before text when an existing line changes", () => {
    const { container } = render(
      <WordBatchPreview
        batch={{
          state: "ready",
          changes: [
            {
              op: "setText",
              before: "Supported customers.",
              after: "Resolved requests.",
            },
          ],
        }}
      />
    )
    expect(screen.getByText("Before")).toBeVisible()
    expect(container.querySelector("del")).toHaveTextContent(
      "Supported customers."
    )
    expect(screen.getByText("After")).toBeVisible()
  })
})
