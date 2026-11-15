import { describe, expect, it, vi } from "vitest"
import { act, fireEvent } from "@testing-library/react"

import {
  L,
  SENTENCE,
  START,
  bar,
  caretAtEnd,
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

describe("the composing flag", () => {
  it("clears on blur so the next keys save", async () => {
    await opened()
    const page = surface()
    caretAtEnd(L.education)
    await act(async () => {
      fireEvent.compositionStart(page, { data: "" })
      fireEvent.blur(page)
    })
    const next = await type(L.name, "X")
    await settle()
    expect(next.defaultPrevented).toBe(true)
    expect(server.textOf(L.name)).toBe("Linh NguyenX")
  })

  it("clears on compositionend so the next keys save", async () => {
    await opened()
    const page = surface()
    caretAtEnd(L.education)
    await act(async () => {
      fireEvent.compositionStart(page, { data: "" })
      fireEvent.compositionEnd(page, { data: "ă" })
    })
    const next = await type(L.name, "X")
    await settle()
    expect(next.defaultPrevented).toBe(true)
    expect(server.textOf(L.education)).toBe("Educationă")
    expect(server.textOf(L.name)).toBe("Linh NguyenX")
  })

  it("clears when the page is drawn again so the next keys save", async () => {
    await opened()
    const page = surface()
    caretAtEnd(L.education)
    await act(async () => {
      fireEvent.compositionStart(page, { data: "" })
      page.dispatchEvent(
        new InputEvent("input", { inputType: "insertText", bubbles: true })
      )
      fireEvent.blur(page)
    })
    const next = await type(L.name, "X")
    await settle()
    expect(next.defaultPrevented).toBe(true)
    expect(server.textOf(L.name)).toBe("Linh NguyenX")
  })
})

describe("saves that only wait for the network", () => {
  async function typedSentence() {
    await opened()
    await type(L.job, SENTENCE)
  }

  it("keeps the words through a lost reply and saves them once", async () => {
    server.state.loseReplies = 1
    await typedSentence()
    await settle()
    expect(status()).not.toMatch(/\bSaved\b/)
    expect(stored()).toContain(SENTENCE)
    await type(L.education, "X")
    await settle()
    expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(server.textOf(L.education)).toBe("EducationX")
    expect(bar()).toBeNull()
  })

  it("keeps the words offline and saves them when the connection returns", async () => {
    server.state.offline = true
    await typedSentence()
    await settle()
    expect(status()).toMatch(/not saved yet/)
    await reload()
    await recover()
    expect(shown(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    await act(async () => {
      server.state.offline = false
      window.dispatchEvent(new Event("online"))
    })
    await settle()
    expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(status()).toMatch(/\bSaved\b/)
    expect(bar()).toBeNull()
  })

  it("keeps the words through a time-out and saves on the next key", async () => {
    server.state.timeouts = 1
    await typedSentence()
    await settle()
    expect(status()).not.toMatch(/\bSaved\b/)
    expect(stored()).toContain(SENTENCE)
    await type(L.education, "X")
    await settle()
    expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
    expect(bar()).toBeNull()
  })

  it.each([429, 503])(
    "waits out a %i with Retry-After and then saves",
    async (code) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
      server.state.busy = [{ status: code, retryAfter: "2" }]
      await typedSentence()
      await settle()
      expect(status()).not.toMatch(/\bSaved\b/)
      expect(bar()).toBeNull()
      await act(async () => {
        vi.advanceTimersByTime(2100)
      })
      await settle()
      expect(server.textOf(L.job)).toBe(`${START[L.job]}${SENTENCE}`)
      expect(status()).toMatch(/\bSaved\b/)
    }
  )
})
