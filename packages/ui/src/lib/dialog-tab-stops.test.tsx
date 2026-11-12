import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { dialogTabStops } from "./dialog-tab-stops"

afterEach(cleanup)

function stopNames(root: HTMLElement) {
  return dialogTabStops(root).map(
    (element) =>
      element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""
  )
}

describe("the tab stops a kit dialog wraps between", () => {
  it("counts only the controls Tab can reach", () => {
    const { container } = render(
      <div>
        <button type="button">First</button>
        <fieldset disabled>
          <legend>
            <button type="button">In legend</button>
          </legend>
          <input aria-label="Locked field" />
        </fieldset>
        <input type="radio" name="size" aria-label="Small" />
        <input type="radio" name="size" aria-label="Large" defaultChecked />
        <input type="radio" name="tone" aria-label="Warm" />
        <input type="radio" name="tone" aria-label="Cool" />
        <button type="button" disabled>
          Disabled
        </button>
        <button type="button" tabIndex={-1}>
          Skipped
        </button>
        <button type="button">Last</button>
      </div>
    )
    expect(stopNames(container.firstElementChild as HTMLElement)).toEqual([
      "First",
      "In legend",
      "Large",
      "Warm",
      "Cool",
      "Last",
    ])
  })

  it("asks the browser to treat visibility hidden as unreachable", () => {
    const { container } = render(
      <div>
        <button type="button">Shown</button>
        <button type="button">Concealed</button>
      </div>
    )
    const asked: unknown[] = []
    for (const button of container.querySelectorAll("button")) {
      button.checkVisibility = (options?: CheckVisibilityOptions) => {
        asked.push(options)
        return !(
          options?.visibilityProperty && button.textContent === "Concealed"
        )
      }
    }
    expect(stopNames(container.firstElementChild as HTMLElement)).toEqual([
      "Shown",
    ])
    expect(asked).toEqual([
      { visibilityProperty: true },
      { visibilityProperty: true },
    ])
  })
})
