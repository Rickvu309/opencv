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

  it("lays the composer out as one row at rest and keeps the controls on the bottom row when the text wraps", () => {
    const prompt = (
      <PromptInput
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
        tools={<button type="button">Add</button>}
        actions={<button type="button">Send</button>}
      />
    )
    const { rerender } = render(prompt)
    const parts = () => {
      const box = screen.getByRole("textbox", { name: "Message Coach" })
      return {
        box,
        group: box.parentElement as HTMLElement,
        start: box.previousElementSibling as HTMLElement,
        end: box.nextElementSibling as HTMLElement,
      }
    }
    const standard = parts()
    expect(standard.group).toHaveAttribute("data-layout", "row")
    expect(standard.group.className).toContain("flex-row")
    expect(standard.group.className).toContain("items-end")
    expect(standard.group.className).toContain("rounded-3xl")
    expect(standard.start).toHaveTextContent("Add")
    expect(standard.end).toHaveTextContent("Send")
    for (const addon of [standard.start, standard.end])
      expect(addon.className).toContain("self-end")
    expect(standard.box.className).toContain("text-base")
    expect(standard.box.className).toContain("md:min-h-11")

    rerender(<PromptInputFrame value="page">{prompt}</PromptInputFrame>)
    const page = parts()
    expect(page.box.className).toContain("md:min-h-12")
    expect(page.box.className).toContain("text-base")
    expect(page.box.className).toContain("md:text-[15px]")
    expect(page.box.className).toContain("max-h-60")
  })

  it("starts one row and stacks the text above the controls when the text has a second line", () => {
    const { rerender } = render(
      <PromptInput
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    const group = screen.getByRole("textbox", { name: "Message Coach" })
      .parentElement as HTMLElement
    expect(group).toHaveAttribute("data-stacked", "false")
    rerender(
      <PromptInput
        value={"First line\nSecond line"}
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    expect(group).toHaveAttribute("data-stacked", "true")
    rerender(
      <PromptInput
        value={"First line\nSecond line, longer"}
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    expect(group).toHaveAttribute("data-stacked", "true")
    rerender(
      <PromptInput
        value="Short"
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    expect(group).toHaveAttribute("data-stacked", "false")
    rerender(
      <PromptInput
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask Coach anything"
        label="Message Coach"
      />
    )
    expect(group).toHaveAttribute("data-stacked", "false")
  })
})
