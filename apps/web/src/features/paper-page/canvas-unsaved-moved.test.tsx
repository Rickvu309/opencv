import { describe, expect, it } from "vitest"
import { act, fireEvent, waitFor, within } from "@testing-library/react"

import {
  copied,
  goOnline,
  GONE,
  L,
  MIXED,
  SENTENCE,
  STALE,
  START,
  bar,
  caretAtEnd,
  key,
  line,
  opened,
  refuseAvailable,
  reload,
  recover,
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
        within(found)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label"))
      ).toEqual(["Copy my unsaved text", "Use the saved page, discards 1 line"])
      expect(within(found).queryByText(/Keep my words/)).toBeNull()
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

    it("copies the unsaved lines and sends nothing over the newer page while the person keeps typing", async () => {
      await moved()
      const posts = server.state.posts
      await act(async () => {
        fireEvent.click(
          within(bar() as HTMLElement).getByRole("button", {
            name: "Copy my unsaved text",
          })
        )
      })
      await settle()
      expect(copied.at(-1)).toBe(`${START[L.job]}${SENTENCE}`)
      await type(L.name, " Thi")
      await type(L.education, " and more")
      await settle()
      expect(server.state.posts).toBe(posts)
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.job)).toBe(START[L.job])
      expect(shown(L.name)).toBe("Linh Nguyen Thi")
      expect(stored()).toContain("Education and more")
      expect(bar()?.textContent).toMatch(/discards 3 lines/)
    })

    it("marks exactly the lines the person changed, with the count Use the saved page states", async () => {
      await opened()
      arm()
      await type(L.name, " Thi")
      await type(L.job, SENTENCE)
      await settle()
      if (after) await after()
      const marked = () =>
        Object.values(L).filter((id) => line(id).hasAttribute("data-unsaved"))
      expect(marked()).toEqual([L.name, L.job])
      expect(bar()?.textContent).toMatch(/discards 2 lines/)
      await reload()
      await recover()
      await type(L.available, "!")
      await settle()
      expect(marked()).toEqual([L.name, L.job, L.available])
      expect(bar()?.textContent).toMatch(/discards 3 lines/)
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.available)).toBe(START[L.available])
      expect(status()).not.toMatch(/\bSaved\b/)
    })

    it("uses the saved page only when asked, says how much it drops, and clears the copy", async () => {
      await moved()
      const discard = within(bar() as HTMLElement).getByRole("button", {
        name: /Use the saved page/,
      })
      expect(bar()?.textContent).toMatch(/discards 1 line\b/)
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
      await type(L.education, "!")
      await settle()
      expect(server.textOf(L.education)).toBe("Education!")
      expect(status()).toMatch(/\bSaved\b/)
    })

    it("offers the same choice after a reload", async () => {
      await moved()
      await reload()
      await recover()
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      await waitFor(() =>
        expect(
          bar(),
          JSON.stringify({ status: status(), stored: stored() })
        ).not.toBeNull()
      )
      expect(server.textOf(L.name)).toBe("Linh Nguyen, MBA")
      expect(server.textOf(L.job)).toBe(START[L.job])
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

describe("a partial resend, an edit elsewhere and a reload, as in review N2", () => {
  it("never offers old text as the person's version and counts only the person's lines", async () => {
    await opened()
    server.state.offline = true
    await type(L.job, " \u2014 I led a five-person team")
    refuseAvailable(MIXED)
    await type(L.available, "Also ", 0)
    await type(L.available, "!")
    await settle()
    await goOnline()
    expect(server.textOf(L.job)).toBe(
      `${START[L.job]} \u2014 I led a five-person team`
    )
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    server.otherTab(L.education, "Education ELSEWHERE")
    await reload()
    await recover()
    await type(L.name, "Q", 4)
    await settle()
    const marked = () =>
      Object.values(L).filter((id) => line(id).hasAttribute("data-unsaved"))
    expect(marked()).toEqual([L.name, L.available])
    expect(bar()?.textContent).toMatch(/discards 2 lines/)
    expect(within(bar() as HTMLElement).queryByText(/Keep my words/)).toBeNull()
    await type(L.education, " & Exchange")
    await settle()
    expect(server.textOf(L.education)).toBe("Education ELSEWHERE")
    expect(server.textOf(L.name)).toBe(START[L.name])
    expect(bar()?.textContent).toMatch(/discards 3 lines/)
    await act(async () => {
      fireEvent.click(
        within(bar() as HTMLElement).getByRole("button", {
          name: /Use the saved page/,
        })
      )
    })
    await settle()
    expect(shown(L.education)).toBe("Education ELSEWHERE")
    expect(shown(L.name)).toBe(START[L.name])
    expect(server.textOf(L.education)).toBe("Education ELSEWHERE")
    expect(bar()).toBeNull()
  })
})
