import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PromptInput } from "@/components/ai-elements/prompt-input.tsx"
import { PromptInputFrame } from "@/components/ai-elements/prompt-input-frame.ts"

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

  it("takes the page composer frame only where the page asks for it", () => {
    const prompt = (
      <PromptInput
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    const { rerender } = render(prompt)
    const parts = () => {
      const box = screen.getByRole("textbox", { name: "Message Coach" })
      return { box, toolbar: box.nextElementSibling as HTMLElement }
    }
    const standard = parts()
    expect(standard.box.className).toContain("min-h-14")
    expect(standard.box.className).not.toContain("md:pt-[15px]")
    expect(standard.toolbar.className).not.toContain("md:pt-3.5")

    rerender(<PromptInputFrame value="page">{prompt}</PromptInputFrame>)
    const { box, toolbar } = parts()
    expect(box.className).toContain("md:min-h-[55px]")
    expect(box.className).toContain("md:pt-[15px]")
    expect(box.className).toContain("md:pb-0")
    expect(box.className).toContain("max-h-48")
    expect(toolbar.className).toContain("md:pt-3.5")
    expect(toolbar.className).toContain("md:pb-[11px]")
  })
})
