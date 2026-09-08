// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  focusAdjacentCanvasField,
  handleCanvasFieldKeyDown,
  listCanvasFields,
} from "./paper-cv-keyboard.ts"

afterEach(() => {
  document.body.innerHTML = ""
})

function field(label: string) {
  const el = document.createElement("span")
  el.setAttribute("role", "textbox")
  el.setAttribute("aria-label", label)
  el.setAttribute("data-paper-canvas-field", "")
  el.contentEditable = "true"
  el.textContent = label
  return el
}

function mountFields(labels: string[]) {
  const root = document.createElement("div")
  root.className = "cv-template-root"
  const nodes = labels.map(field)
  for (const node of nodes) root.append(node)
  document.body.append(root)
  return { root, nodes }
}

describe("café keyboard (QVE-208)", () => {
  it("lists structured fields in DOM order", () => {
    const { nodes } = mountFields(["Full name", "Headline", "Summary"])
    expect(listCanvasFields().map((el) => el.getAttribute("aria-label"))).toEqual(
      ["Full name", "Headline", "Summary"]
    )
    expect(nodes).toHaveLength(3)
  })

  it("Tabs forward and Shift+Tabs backward between fields", () => {
    const { nodes } = mountFields(["Full name", "Headline", "Summary"])
    const [name, headline, summary] = nodes
    name!.focus()
    expect(focusAdjacentCanvasField(name!, 1)).toBe(headline)
    expect(headline).toHaveFocus()
    expect(focusAdjacentCanvasField(headline!, 1)).toBe(summary)
    expect(focusAdjacentCanvasField(summary!, -1)).toBe(headline)
    expect(headline).toHaveFocus()
  })

  it("Esc blurs without leaving focus on the field", () => {
    const { nodes } = mountFields(["Summary"])
    const summary = nodes[0]!
    summary.focus()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    expect(
      handleCanvasFieldKeyDown({
        key: "Escape",
        shiftKey: false,
        preventDefault,
        stopPropagation,
        currentTarget: summary,
      })
    ).toBe(true)
    expect(preventDefault).toHaveBeenCalled()
    expect(stopPropagation).toHaveBeenCalled()
    expect(summary).not.toHaveFocus()
    expect(document.activeElement === summary).toBe(false)
  })

  it("Tab on the last field blurs instead of trapping", () => {
    const { nodes } = mountFields(["Full name", "Headline"])
    const headline = nodes[1]!
    headline.focus()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    handleCanvasFieldKeyDown({
      key: "Tab",
      shiftKey: false,
      preventDefault,
      stopPropagation,
      currentTarget: headline,
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(headline).not.toHaveFocus()
  })

  it("ignores composing Tab and Escape", () => {
    const { nodes } = mountFields(["Headline"])
    const headline = nodes[0]!
    headline.focus()
    const preventDefault = vi.fn()
    expect(
      handleCanvasFieldKeyDown({
        key: "Tab",
        shiftKey: false,
        preventDefault,
        stopPropagation: vi.fn(),
        currentTarget: headline,
        nativeEvent: { isComposing: true },
      })
    ).toBe(false)
    expect(
      handleCanvasFieldKeyDown({
        key: "Escape",
        shiftKey: false,
        preventDefault,
        stopPropagation: vi.fn(),
        currentTarget: headline,
        isComposing: true,
      })
    ).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(headline).toHaveFocus()
  })
})
