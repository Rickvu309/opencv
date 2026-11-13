import { describe, expect, it } from "vitest"
import { act, fireEvent, within } from "@testing-library/react"

import {
  CARET,
  HELD_GAP,
  L,
  MIXED,
  SENTENCE,
  START,
  bar,
  caretAtEnd,
  copied,
  goOnline,
  key,
  lastLine,
  line,
  opened,
  refuseAvailable,
  release,
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

const LINE_ROWS = [
  { code: "MIXED_FORMAT", note: MIXED },
  { code: "HELD_GAP", note: HELD_GAP },
  { code: "CARET", note: CARET },
]

describe.each(LINE_ROWS)("one line the server refuses ($code)", ({ note }) => {
  async function refusedAfterOfflineSentence() {
    await opened()
    server.state.offline = true
    await type(L.job, SENTENCE)
    await settle()
    refuseAvailable(note)
    await type(L.available, "!")
    await settle()
    await act(async () => {
      server.state.offline = false
      window.dispatchEvent(new Event("online"))
    })
    await settle()
  }

  it("keeps the sentence typed offline on another line and saves it", async () => {
    await refusedAfterOfflineSentence()
    expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
  })

  it("keeps the refused words on their line, marked as not saved with the reason", async () => {
    await refusedAfterOfflineSentence()
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
    expect(server.textOf(L.available)).toBe(START[L.available])
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    expect(line(L.job)).not.toHaveAttribute("data-unsaved")
    expect(
      within(bar() as HTMLElement).getByText(note, { exact: false })
    ).toBeVisible()
    expect(status()).not.toMatch(/\bSaved\b/)
  })

  it("keeps the refused words in the copy on this computer and offers them after a reload", async () => {
    await refusedAfterOfflineSentence()
    expect(stored()).toContain(`${START[L.available]}!`)
    expect(stored()).toContain(SENTENCE)
    await reload()
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    expect(status()).not.toMatch(/\bSaved\b/)
  })

  it("shows and saves later typing on another line, and keeps the mark", async () => {
    await refusedAfterOfflineSentence()
    const event = await type(L.education, " and more")
    await settle()
    expect(event.defaultPrevented).toBe(true)
    expect(server.textOf(L.education)).toBe("Education and more")
    expect(line(L.available)).toHaveAttribute("data-unsaved")
  })

  it("keeps everything when a second refusal follows on the same line", async () => {
    await refusedAfterOfflineSentence()
    await type(L.available, "?")
    await settle()
    expect(shown(L.available)).toBe(`${START[L.available]}!?`)
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(stored()).toContain(`${START[L.available]}!?`)
  })

  it("copies the refused line's words", async () => {
    await refusedAfterOfflineSentence()
    await act(async () => {
      fireEvent.click(
        within(bar() as HTMLElement).getByRole("button", {
          name: /Copy my text/,
        })
      )
    })
    expect(copied).toEqual([`${START[L.available]}!`])
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
  })

  it("restores only the refused line, then Undo and Redo never show it as saved", async () => {
    await refusedAfterOfflineSentence()
    await act(async () => {
      fireEvent.click(
        within(bar() as HTMLElement).getByRole("button", {
          name: /Restore this line/,
        })
      )
    })
    await settle()
    expect(shown(L.available)).toBe(START[L.available])
    expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(line(L.available)).not.toHaveAttribute("data-unsaved")
    expect(stored()).not.toContain(`${START[L.available]}!`)
    expect(status()).toMatch(/\bSaved\b/)
    await key("z", { ctrlKey: true })
    await settle()
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    expect(status()).not.toMatch(/\bSaved\b/)
    await key("z", { ctrlKey: true, shiftKey: true })
    await settle()
    expect(shown(L.available)).toBe(START[L.available])
    expect(server.textOf(L.available)).toBe(START[L.available])
  })

  it("clears the mark when Undo takes the refused letter away, and marks it again on Redo", async () => {
    await opened()
    refuseAvailable(note)
    await type(L.available, "!")
    await settle()
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    await key("z", { ctrlKey: true })
    await settle()
    expect(shown(L.available)).toBe(START[L.available])
    expect(line(L.available)).not.toHaveAttribute("data-unsaved")
    expect(status()).toMatch(/\bSaved\b/)
    await key("z", { ctrlKey: true, shiftKey: true })
    await settle()
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
    expect(line(L.available)).toHaveAttribute("data-unsaved")
    expect(status()).not.toMatch(/\bSaved\b/)
  })

  it("saves typing on another line made while the refusal was on its way", async () => {
    await opened()
    refuseAvailable(note)
    const done = release()
    await type(L.available, "!")
    await settle(20)
    await type(L.education, "X")
    done()
    await settle()
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
    expect(server.textOf(L.education)).toBe("EducationX")
    expect(line(L.available)).toHaveAttribute("data-unsaved")
  })

  it("keeps the composition and saves the next keys when the refusal arrives during it", async () => {
    await opened()
    refuseAvailable(note)
    const done = release()
    await type(L.available, "!")
    await settle(20)
    const page = surface()
    caretAtEnd(L.education)
    await act(async () => {
      fireEvent.compositionStart(page, { data: "" })
    })
    done()
    await settle()
    expect(surface()).toBe(page)
    await act(async () => {
      fireEvent.compositionEnd(page, { data: "tiếng" })
    })
    await settle()
    expect(shown(L.education)).toBe("Educationtiếng")
    const next = await type(L.name, "X")
    await settle()
    expect(next.defaultPrevented).toBe(true)
    expect(server.textOf(L.name)).toBe("Linh NguyenX")
    expect(server.textOf(L.education)).toBe("Educationtiếng")
    expect(shown(L.available)).toBe(`${START[L.available]}!`)
  })
})

describe("a refused line next to a new line, as in review N1", () => {
  async function refusedWithNewLine() {
    await opened()
    server.state.offline = true
    caretAtEnd(L.education)
    await key("Enter")
    const fresh = lastLine()
    await type(fresh, "New line")
    refuseAvailable(MIXED)
    await type(L.available, "Also ", 0)
    await type(L.available, "!")
    await settle()
    await goOnline()
    return fresh
  }

  it("goes quiet once the page settles and sends nothing while idle", async () => {
    await refusedWithNewLine()
    const posts = server.state.posts
    expect(posts).toBeLessThanOrEqual(4)
    await settle(600)
    expect(server.state.posts).toBe(posts)
  })

  it("saves the new line, marks only the refused line, and never deletes a line still on screen", async () => {
    await refusedWithNewLine()
    expect(server.words().split("\n")).toEqual([
      START[L.name],
      START[L.job],
      START[L.available],
      START[L.education],
      "New line",
    ])
    const marked = [...surface().querySelectorAll("p[data-unsaved]")].map(
      (node) => node.textContent?.replaceAll("\u200b", "")
    )
    expect(marked).toEqual([`Also ${START[L.available]}!`])
    expect(
      server.state.batches.flatMap((batch) =>
        batch.ops.filter((op) => op.op === "delete")
      )
    ).toEqual([])
    await reload()
    expect(surface().querySelectorAll("p[data-unsaved]").length).toBe(1)
    expect(bar()?.textContent).toMatch(/is not saved/)
    await type(L.name, "Q")
    await settle()
    expect(server.textOf(L.name)).toBe("Linh NguyenQ")
    expect(server.words()).toContain("New line")
  })
})
