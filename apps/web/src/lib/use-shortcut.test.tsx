import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useShortcut } from "@/lib/use-shortcut.ts"

function Probe({
  onPress,
  inFields = false,
}: {
  onPress: () => void
  inFields?: boolean
}) {
  useShortcut({ key: "[", onPress, inFields })
  return <input aria-label="field" />
}

function press(target: Element | Document, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key: "[", ...init })
}

describe("useShortcut", () => {
  it("runs on the key and stops after unmount", () => {
    const onPress = vi.fn()
    const view = render(<Probe onPress={onPress} />)
    press(document.body)
    expect(onPress).toHaveBeenCalledTimes(1)
    view.unmount()
    press(document.body)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("ignores the key while typing in a field unless the field is allowed", () => {
    const onPress = vi.fn()
    const view = render(<Probe onPress={onPress} />)
    press(view.getByLabelText("field"))
    expect(onPress).not.toHaveBeenCalled()
    view.rerender(<Probe onPress={onPress} inFields />)
    press(view.getByLabelText("field"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("ignores an input method composition and a held key", () => {
    const onPress = vi.fn()
    render(<Probe onPress={onPress} />)
    press(document.body, { isComposing: true })
    press(document.body, { keyCode: 229 })
    press(document.body, { repeat: true })
    expect(onPress).not.toHaveBeenCalled()
  })

  it("ignores a modifier chord for a plain key", () => {
    const onPress = vi.fn()
    render(<Probe onPress={onPress} />)
    press(document.body, { ctrlKey: true })
    press(document.body, { metaKey: true })
    expect(onPress).not.toHaveBeenCalled()
  })

  it("ignores the key while a pointer is held down and works again after release", () => {
    const onPress = vi.fn()
    render(<Probe onPress={onPress} />)
    fireEvent.pointerDown(document.body, { pointerId: 1, buttons: 1 })
    press(document.body)
    expect(onPress).not.toHaveBeenCalled()
    fireEvent.pointerUp(document.body, { pointerId: 1 })
    press(document.body)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("forgets a drag that lost its pointerup", () => {
    const onPress = vi.fn()
    render(<Probe onPress={onPress} />)
    fireEvent.pointerDown(document.body, { pointerId: 2, buttons: 1 })
    fireEvent.pointerMove(document.body, { pointerId: 2, buttons: 0 })
    press(document.body)
    expect(onPress).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(document.body, { pointerId: 3, buttons: 1 })
    fireEvent.blur(window)
    press(document.body)
    expect(onPress).toHaveBeenCalledTimes(2)
  })
})
