import "@testing-library/jest-dom/vitest"
import { createRef, useState } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SearchInput } from "./search-input"

afterEach(cleanup)

function ControlledSearch({
  onValueChange,
}: {
  onValueChange: (value: string) => void
}) {
  const [value, setValue] = useState("")
  return (
    <SearchInput
      aria-label="Search integrations"
      name="search"
      placeholder="Search integrations"
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        onValueChange(nextValue)
      }}
    />
  )
}

describe("SearchInput", () => {
  it("forwards normal input props and returns controlled values", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ControlledSearch onValueChange={onValueChange} />)
    const input = screen.getByRole("searchbox", { name: "Search integrations" })
    expect(input).toHaveAttribute("name", "search")
    expect(input).toHaveAttribute("placeholder", "Search integrations")
    expect(input.closest('[data-slot="search-input"]')).toBeInTheDocument()
    await user.type(input, "mail")
    expect(input).toHaveValue("mail")
    expect(onValueChange).toHaveBeenLastCalledWith("mail")
  })

  it("forwards the input ref", () => {
    const ref = createRef<HTMLInputElement>()
    render(
      <SearchInput
        ref={ref}
        aria-label="Search integrations"
        value=""
        onValueChange={vi.fn()}
      />
    )
    expect(ref.current).toBe(
      screen.getByRole("searchbox", { name: "Search integrations" })
    )
  })

  it("clears through the controlled callback and restores input focus", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SearchInput
        aria-label="Search integrations"
        value="zoom"
        onValueChange={onValueChange}
      />
    )
    const input = screen.getByRole("searchbox", { name: "Search integrations" })
    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onValueChange).toHaveBeenCalledWith("")
    expect(input).toHaveFocus()
  })

  it.each([
    { label: "disabled", props: { disabled: true } },
    { label: "read-only", props: { readOnly: true } },
  ])("does not clear a $label value", async ({ props }) => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SearchInput
        aria-label="Search integrations"
        value="zoom"
        onValueChange={onValueChange}
        {...props}
      />
    )
    const input = screen.getByRole("searchbox", { name: "Search integrations" })
    const clear = screen.getByRole("button", { name: "Clear search" })
    expect(clear).toBeDisabled()
    if ("disabled" in props) expect(input).toBeDisabled()
    if ("readOnly" in props) expect(input).toHaveAttribute("readonly")
    await user.click(clear)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("hides the clear action for an empty value and decorates the icon", () => {
    const { container } = render(
      <SearchInput
        aria-label="Search integrations"
        value=""
        onValueChange={vi.fn()}
      />
    )
    const input = screen.getByRole("searchbox", { name: "Search integrations" })
    expect(input).toHaveAttribute("type", "search")
    expect(container.querySelector("button")).toBeNull()
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })
})
