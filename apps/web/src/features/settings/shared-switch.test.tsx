import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { Switch } from "@workspace/ui/components/switch"

afterEach(cleanup)

it.each(["default", "sm"] as const)(
  "%s switch remains controlled and ignores keyboard and pointer activation while disabled",
  async (size) => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <Switch
        size={size}
        checked
        onCheckedChange={onCheckedChange}
        aria-label="Memory"
      />
    )
    const control = screen.getByRole("switch", { name: "Memory" })
    await user.tab()
    expect(control).toHaveFocus()
    await user.keyboard(" ")
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(false)
    expect(control).toBeChecked()

    rerender(
      <Switch
        size={size}
        checked
        disabled
        onCheckedChange={onCheckedChange}
        aria-label="Memory"
      />
    )
    expect(control).toHaveAttribute("aria-disabled", "true")
    await user.click(control)
    control.focus()
    await user.keyboard(" ")
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(control).toBeChecked()

    rerender(
      <Switch
        size={size}
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="Memory"
      />
    )
    expect(control).not.toBeChecked()
    expect(control).not.toHaveAttribute("aria-disabled", "true")
    control.focus()
    await user.keyboard(" ")
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
    expect(onCheckedChange.mock.calls[1]?.[0]).toBe(true)
  }
)
