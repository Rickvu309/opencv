import { afterEach, describe, expect, it } from "vitest"
import { act, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { pendingSent } from "./canvas-save-record.ts"
import { WritingCanvas } from "./canvas.tsx"
import {
  DOC,
  cleanNetworkPage,
  revisionNumber,
  fakeServer,
  realTurns,
  turnsUntil,
} from "./test/canvas-network.ts"

afterEach(cleanNetworkPage)

describe("an online event after a completed request-only failure", () => {
  async function failedPage() {
    const server = fakeServer("Hello")
    const view = render(<WritingCanvas docId={DOC} />)
    await screen.findByText("Saved")
    server.state.failSends = 1
    const article = screen.getByRole("article", { name: "Page" })
    await act(async () => {
      const range = document.createRange()
      const text = article.querySelector("p")?.firstChild
      if (!text) throw new Error("missing paragraph text")
      range.setStart(text, text.textContent?.length ?? 0)
      range.collapse(true)
      document.getSelection()?.removeAllRanges()
      document.getSelection()?.addRange(range)
      article.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: " there",
          bubbles: true,
          cancelable: true,
        })
      )
      await turnsUntil(() => server.state.attempts.length === 1)
      await realTurns()
    })
    expect(navigator.onLine).toBe(true)
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    expect(server.state.committed).toEqual([])
    return { ...server, view }
  }

  it("replays the original key and input once across duplicate online events", async () => {
    const { state, words } = await failedPage()
    await act(async () => {
      for (let count = 0; count < 3; count += 1)
        window.dispatchEvent(new Event("online"))
    })
    await screen.findByText("Saved")
    expect(state.attempts).toHaveLength(2)
    expect(state.attempts[1]).toEqual(state.attempts[0])
    expect(state.committed).toEqual(["Hello there"])
    expect(words()).toBe("Hello there")
    await act(async () => {
      window.dispatchEvent(new Event("online"))
      await realTurns()
    })
    expect(state.attempts).toHaveLength(2)
  })

  it("refuses the frozen original after a foreign head and never replaces that head", async () => {
    const { state, words } = await failedPage()
    const line = state.lines[0]
    if (!line) throw new Error("missing line")
    line.text = "Another tab's words"
    state.revision = revisionNumber(9)
    expect(await pendingSent(DOC)).toBe(true)
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    await screen.findByRole("button", { name: /^Use the saved page/ })
    expect(state.attempts).toHaveLength(2)
    expect(state.attempts[1]).toEqual(state.attempts[0])
    expect(state.committed).toEqual([])
    expect(words()).toBe("Another tab's words")
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: "Page" })).toHaveTextContent(
      "Hello there"
    )
    await act(async () => {
      window.dispatchEvent(new Event("online"))
      await realTurns()
    })
    expect(state.attempts).toHaveLength(2)
  })

  it("removes the online listener when the page unmounts", async () => {
    const { state, view } = await failedPage()
    view.unmount()
    await act(async () => {
      window.dispatchEvent(new Event("online"))
      await realTurns()
    })
    expect(state.attempts).toHaveLength(1)
    expect(state.committed).toEqual([])
  })
})
