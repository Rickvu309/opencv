import { describe, expect, it } from "vitest"
import { act, fireEvent, within } from "@testing-library/react"

import {
  GONE,
  L,
  SENTENCE,
  STALE,
  START,
  bar,
  caretAtEnd,
  key,
  line,
  opened,
  reload,
  server,
  settle,
  shown,
  status,
  stored,
  surface,
  type,
  openUnsavedPageSuite,
} from "@/test/paper-page-unsaved.tsx"

openUnsavedPageSuite()

const MOVED_ROWS = [
  {
    cause: "another write lands between the page's read and its save",
    arm: () => {
      server.state.raceOnce = {
        handle: L.name,
        text: "Linh Nguyen, MBA",
        reply: STALE,
      }
    },
  },
  {
    cause: "another write lands while the save is being committed",
    arm: () => {
      server.state.raceOnce = {
        handle: L.name,
        text: "Linh Nguyen, MBA",
        reply: GONE,
      }
    },
  },
  {
    cause: "an approved edit lands while the page is offline",
    arm: () => {
      server.state.offline = true
    },
    after: async () => {
      server.otherTab(L.name, "Linh Nguyen, MBA")
      await act(async () => {
        server.state.offline = false
        window.dispatchEvent(new Event("online"))
      })
      await settle()
    },
  },
]

describe.each(MOVED_ROWS)(
  "the page changed elsewhere: $cause",
  ({ arm, after }) => {
    async function moved() {
      await opened()
      arm()
      await type(L.job, SENTENCE)
      await settle()
      if (after) await after()
    }

    it("keeps the words on screen, unsaved, with a bar that offers both choices", async () => {
      await moved()
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(server.textOf(L.job)).toBe(START[L.job])
      const found = bar() as HTMLElement
      expect(found).toBeVisible()
      expect(
        within(found).getByRole("button", { name: "Keep my words" })
      ).toBeVisible()
      expect(
        within(found).getByRole("button", { name: /Use the saved page/ })
      ).toBeVisible()
      expect(status()).not.toMatch(/\bSaved\b/)
      expect(stored()).toContain(SENTENCE)
    })

    it("lets the person keep typing before choosing", async () => {
      await moved()
      const more = await type(L.education, "X")
      await settle()
      expect(more.defaultPrevented).toBe(true)
      expect(shown(L.education)).toBe("EducationX")
      expect(stored()).toContain("EducationX")
      expect(bar()).not.toBeNull()
    })

    it("keeps my words on top of the new saved page", async () => {
      await moved()
      await act(async () => {
        fireEvent.click(
          within(bar() as HTMLElement).getByRole("button", {
            name: "Keep my words",
          })
        )
      })
      await settle()
      expect(shown(L.name)).toBe("Linh Nguyen, MBA")
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(bar()).toBeNull()
      expect(status()).toMatch(/\bSaved\b/)
      await key("z", { ctrlKey: true })
      await settle()
      expect(shown(L.name)).toBe("Linh Nguyen, MBA")
    })

    it("marks a line changed in both places and keeps my version on it", async () => {
      await opened()
      arm()
      await type(L.name, " Thi")
      await type(L.job, SENTENCE)
      await settle()
      if (after) await after()
      await act(async () => {
        fireEvent.click(
          within(bar() as HTMLElement).getByRole("button", {
            name: "Keep my words",
          })
        )
      })
      await settle()
      expect(shown(L.name)).toBe("Linh Nguyen Thi")
      expect(line(L.name)).toHaveAttribute("data-unsaved")
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(status()).not.toMatch(/\bSaved\b/)
      await reload()
      expect(shown(L.name)).toBe("Linh Nguyen Thi")
      expect(line(L.name)).toHaveAttribute("data-unsaved")
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(status()).not.toMatch(/\bSaved\b/)
    })

    it("still marks a line changed in both places when the person reloads before choosing", async () => {
      await opened()
      arm()
      await type(L.name, " Thi")
      await type(L.job, SENTENCE)
      await settle()
      if (after) await after()
      await reload()
      await act(async () => {
        fireEvent.click(
          within(bar() as HTMLElement).getByRole("button", {
            name: "Keep my words",
          })
        )
      })
      await settle()
      expect(shown(L.name)).toBe("Linh Nguyen Thi")
      expect(line(L.name)).toHaveAttribute("data-unsaved")
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    })

    it("uses the saved page only when asked, says how much it drops, and clears the copy", async () => {
      await moved()
      const discard = within(bar() as HTMLElement).getByRole("button", {
        name: /Use the saved page/,
      })
      expect(bar()?.textContent).toMatch(/1 line/)
      await act(async () => {
        fireEvent.click(discard)
      })
      await settle()
      expect(shown(L.job)).toBe(START[L.job])
      expect(shown(L.name)).toBe("Linh Nguyen, MBA")
      expect(stored()).not.toContain(SENTENCE)
      expect(bar()).toBeNull()
      await key("z", { ctrlKey: true })
      await key("z", { ctrlKey: true, shiftKey: true })
      await settle()
      expect(shown(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
    })

    it("offers the same choice after a reload", async () => {
      await moved()
      await reload()
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(bar()).not.toBeNull()
      expect(status()).not.toMatch(/\bSaved\b/)
    })

    it("does not break a composition when the news arrives during it", async () => {
      await opened()
      arm()
      await type(L.job, SENTENCE)
      const page = surface()
      caretAtEnd(L.education)
      await act(async () => {
        fireEvent.compositionStart(page, { data: "" })
      })
      await settle()
      if (after) await after()
      await act(async () => {
        fireEvent.compositionEnd(page, { data: "tiếng" })
      })
      expect(surface()).toBe(page)
      const next = await type(L.name, "X")
      expect(next.defaultPrevented).toBe(true)
      expect(shown(L.education)).toBe("Educationtiếng")
    })
  }
)
