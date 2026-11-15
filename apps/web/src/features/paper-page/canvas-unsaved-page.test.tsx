import { describe, expect, it } from "vitest"
import { act, fireEvent, within } from "@testing-library/react"

import {
  L,
  QUOTA,
  READ_ONLY,
  SENTENCE,
  START,
  bar,
  caretAtEnd,
  copied,
  opened,
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

const PAGE_ROWS = [
  {
    cause: "a document Paper can only read",
    arm: () => {
      server.state.refuse = () => READ_ONLY
    },
    reason: READ_ONLY,
    signIn: false,
  },
  {
    cause: "full Word edit storage",
    arm: () => {
      server.state.refuse = () => QUOTA
    },
    reason: QUOTA,
    signIn: false,
  },
  {
    cause: "a signed-out person",
    arm: () => {
      server.state.answer = {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Sign in to continue.",
      }
    },
    reason: "You are signed out.",
    signIn: true,
  },
  {
    cause: "a deleted document",
    arm: () => {
      server.state.answer = {
        status: 404,
        code: "NOT_FOUND",
        message: "That page was not found.",
      }
    },
    reason: "This page is no longer available.",
    signIn: false,
  },
]

describe.each(PAGE_ROWS)(
  "a page that cannot be saved: $cause",
  ({ arm, reason, signIn }) => {
    async function refused() {
      await opened()
      arm()
      await type(L.job, SENTENCE)
      await type(L.available, "!")
      await settle()
    }

    it("keeps every word, marks the page as not saved and says why", async () => {
      await refused()
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(shown(L.available)).toBe(`${START[L.available]}!`)
      expect(
        within(bar() as HTMLElement).getByText(reason, { exact: false })
      ).toBeVisible()
      expect(status()).not.toMatch(/\bSaved\b/)
      expect(stored()).toContain(SENTENCE)
      const more = await type(L.education, "X")
      await settle()
      expect(more.defaultPrevented).toBe(true)
      expect(shown(L.education)).toBe("EducationX")
      expect(stored()).toContain("EducationX")
    })

    it("copies all the unsaved words", async () => {
      await refused()
      await act(async () => {
        fireEvent.click(
          within(bar() as HTMLElement).getByRole("button", {
            name: "Copy all my unsaved text",
          })
        )
      })
      expect(copied[0]).toContain(`${START[L.job]}${SENTENCE}`)
      expect(copied[0]).toContain(`${START[L.available]}!`)
    })

    it(
      signIn
        ? "offers to sign in again without leaving the page"
        : "offers no sign-in",
      async () => {
        await refused()
        const link = within(bar() as HTMLElement).queryByRole("link", {
          name: "Sign in again",
        })
        if (signIn) expect(link).toHaveAttribute("target", "_blank")
        else expect(link).toBeNull()
      }
    )

    it("still offers the words after a reload and keeps them through a second refusal", async () => {
      await refused()
      await type(L.education, "Y")
      await settle()
      await reload()
      await recover()
      expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(shown(L.education)).toBe("EducationY")
      expect(status()).not.toMatch(/\bSaved\b/)
    })

    it("does not break a composition when the refusal arrives during it", async () => {
      await opened()
      arm()
      await type(L.job, SENTENCE)
      const page = surface()
      caretAtEnd(L.education)
      await act(async () => {
        fireEvent.compositionStart(page, { data: "" })
      })
      await settle()
      await act(async () => {
        fireEvent.compositionEnd(page, { data: "đ" })
      })
      expect(surface()).toBe(page)
      const next = await type(L.name, "X")
      expect(next.defaultPrevented).toBe(true)
      expect(shown(L.name)).toBe("Linh NguyenX")
      expect(shown(L.education)).toBe("Educationđ")
    })
  }
)
