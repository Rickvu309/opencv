import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PromptInput } from "@/components/ai-elements/prompt-input.tsx"

afterEach(() => {
  cleanup()
})

function renderPrompt(submitBlocked: boolean) {
  const onSubmit = vi.fn()
  render(
    <PromptInput
      value="Draft a cover letter"
      onValueChange={vi.fn()}
      onSubmit={onSubmit}
      submitBlocked={submitBlocked}
      placeholder="Ask the Coach"
      label="Message the Coach"
    />
  )
  return onSubmit
}

describe("PromptInput", () => {
  it("sends on Enter", () => {
    const onSubmit = renderPrompt(false)

    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Message the Coach" }),
      {
        key: "Enter",
      }
    )

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it("does nothing on Enter while a turn runs", () => {
    const onSubmit = renderPrompt(true)

    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Message the Coach" }),
      {
        key: "Enter",
      }
    )

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
