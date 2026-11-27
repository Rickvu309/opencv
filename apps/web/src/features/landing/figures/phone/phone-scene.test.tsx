import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"

import {
  LANDING_FIGURE_LABELS,
  LANDING_PHONE_SCENE_LABELS,
  type LandingPhoneSceneId,
} from "../../landing-copy.ts"
import { LandingFigure } from "../landing-figure.tsx"

const PHONE_IDS = Object.keys(
  LANDING_PHONE_SCENE_LABELS
) as LandingPhoneSceneId[]

class StillObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function viewport(phone: boolean) {
  vi.stubGlobal("IntersectionObserver", StillObserver)
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: phone && query.includes("max-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  )
}

function fontsLoadingUntil() {
  let finish = () => {}
  const loaded = new Promise<void>((resolve) => {
    finish = resolve
  })
  const load = vi.fn(() => loaded.then(() => []))
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load, status: "loaded", ready: loaded },
  })
  return { finish, load }
}

const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
})

describe("landing phone scenes", () => {
  it.each(PHONE_IDS)(
    "%s shows its phone scene in a phone column",
    async (id) => {
      viewport(true)
      render(<LandingFigure id={id} />)

      const scene = screen.getByRole("img", {
        name: LANDING_PHONE_SCENE_LABELS[id],
      })
      expect(scene.firstElementChild).toHaveAttribute("aria-hidden", "true")
      expect(
        screen.queryByRole("img", { name: LANDING_FIGURE_LABELS[id] })
      ).toBeNull()
    }
  )

  it("keeps the desktop figure wider than a phone column", () => {
    viewport(false)
    render(<LandingFigure id="paper" />)

    expect(
      screen.getByRole("img", { name: LANDING_FIGURE_LABELS.paper })
    ).toBeInTheDocument()
  })

  it("draws a phone scene only once every landing Inter weight has loaded, so its labels are measured in the real font", async () => {
    viewport(true)
    const fonts = fontsLoadingUntil()
    const { container } = render(<LandingFigure id="paper" />)

    const scene = screen.getByRole("img", {
      name: LANDING_PHONE_SCENE_LABELS.paper,
    })
    expect(scene).toHaveAttribute("data-loading")
    expect(container.querySelector(".ss-stage")).toBeNull()
    expect(fonts.load.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      "400 16px Inter",
      "500 16px Inter",
      "600 16px Inter",
    ])

    await act(async () => fonts.finish())

    expect(scene).not.toHaveAttribute("data-loading")
    expect(container.querySelector(".ss-stage")).not.toBeNull()
  })
})
