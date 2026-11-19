import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatLog } from "@/components/ai-elements/chat.tsx"
import {
  STREAMING_COACH_ID,
  liveSendKey,
  type ChatViewMessage,
} from "@/features/coach/chat-messages.ts"
import {
  CoachTurns,
  type CoachTurnsProps,
} from "@/features/coach/coach-turns.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const history: ChatViewMessage[] = [
  { id: "user-1", role: "user", text: "Look at my CV" },
  { id: "coach-1", role: "coach", text: "Lead with the outcome." },
]

const ask: ChatViewMessage = {
  id: "local-abc",
  role: "user",
  text: "Shorten it",
}

function turns(props: CoachTurnsProps) {
  return (
    <ChatLog>
      <CoachTurns {...props} />
    </ChatLog>
  )
}

function item(container: HTMLElement, messageId: string) {
  return container.querySelector<HTMLElement>(
    `[data-slot="message-scroller-item"][data-message-id="${messageId}"]`
  )
}

function items(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLElement>(
      '[data-slot="message-scroller-item"]'
    ),
  ]
}

function fold(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    "[data-slot='coach-working'], [data-slot='coach-worked-for']"
  )
}

function allowMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe("Coach turn motion", () => {
  it("opens a saved chat with no entrance motion", () => {
    const view = render(
      turns({
        messages: [...history.slice(0, 1), { ...history[1]!, workedMs: 2000 }],
      })
    )
    for (const element of items(view.container))
      expect(element.className).not.toMatch(/motion-(rise|send)/)
    expect(fold(view.container)?.className).not.toContain("motion-rise")
  })

  it("lifts a sent message in and fades the Working fold in after a short hold", () => {
    const view = render(turns({ messages: [...history, ask], waiting: true }))
    expect(item(view.container, "local-abc")?.className).toContain(
      "motion-send"
    )
    const working = fold(view.container)
    expect(working?.getAttribute("data-slot")).toBe("coach-working")
    expect(working?.className).toContain("motion-rise")
    expect(working?.className).toContain("delay-(--duration-micro)")
  })

  it("keeps the bubble, the reply and its fold on the page from send to saved reply", () => {
    const view = render(
      turns({
        messages: history,
        pendingUser: { id: "pending-user", role: "user", text: "Shorten it" },
        waiting: true,
      })
    )
    const bubble = item(view.container, "pending-user")
    const reply = item(view.container, "coach-working")
    const working = fold(view.container)
    expect(bubble?.className).toContain("motion-send")
    expect(reply).not.toBeNull()

    view.rerender(
      turns({
        messages: [
          ...history,
          ask,
          { id: STREAMING_COACH_ID, role: "coach", text: "Cut the intro." },
        ],
      })
    )
    expect(items(view.container)[2]).toBe(bubble)
    expect(item(view.container, STREAMING_COACH_ID)).toBe(reply)
    expect(fold(view.container)).toBe(working)

    view.rerender(
      turns({
        messages: [
          ...history,
          { id: "user-2", role: "user", text: "Shorten it" },
          {
            id: "coach-2",
            role: "coach",
            text: "Cut the intro.",
            workedMs: 2000,
          },
        ],
      })
    )
    expect(item(view.container, "user-2")).toBe(bubble)
    expect(item(view.container, "coach-2")).toBe(reply)
    expect(fold(view.container)).toBe(working)
    expect(fold(view.container)?.getAttribute("data-slot")).toBe(
      "coach-worked-for"
    )
    expect(fold(view.container)).toHaveTextContent("Worked for 2s")
  })

  it("turns the mark one quarter for each new step and rests between steps", () => {
    const quarter = (container: HTMLElement) =>
      container.querySelector<SVGPathElement>(
        "[data-slot='opencv-mark-quarter']"
      )?.style.transform
    const view = render(turns({ messages: [...history, ask], waiting: true }))
    expect(quarter(view.container)).toBe("rotate(0deg)")
    view.rerender(
      turns({
        messages: [...history, ask],
        waiting: true,
        progress: {
          active: true,
          rows: [
            { id: "a", label: "Read your CV", status: "completed" },
            { id: "b", label: "Check the Job", status: "running" },
          ],
        },
      })
    )
    expect(quarter(view.container)).toBe("rotate(180deg)")
    const spinners = view.container.querySelectorAll(
      "[data-slot='coach-step-spinner']"
    )
    expect(spinners).toHaveLength(1)
    expect(
      spinners[0]?.closest("[data-slot='coach-progress-row']")
    ).toHaveAttribute("data-status", "running")
  })

  it("writes a streaming reply in word by word, each word fading in, and shows a saved reply whole", () => {
    allowMotion()
    const frames: FrameRequestCallback[] = []
    let clock = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback)
    )
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const reply = "Cut the intro and lead with the result you shipped."
    const view = render(
      turns({
        messages: [
          ...history,
          ask,
          { id: STREAMING_COACH_ID, role: "coach", text: reply },
        ],
      })
    )
    const response = () =>
      item(view.container, STREAMING_COACH_ID)?.querySelector(
        '[data-slot="response"]'
      )
    expect(response()?.textContent ?? "").toBe("")
    for (let frame = 0; frame < 3; frame++) {
      clock += 24
      act(() => frames.splice(0).forEach((callback) => callback(clock)))
    }
    const shown = response()?.textContent ?? ""
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(reply.length)
    const words = response()?.querySelectorAll(".motion-word") ?? []
    expect(words.length).toBeGreaterThan(0)
    expect(item(view.container, "coach-1")?.textContent).toContain(
      "Lead with the outcome."
    )
    expect(
      item(view.container, "coach-1")?.querySelectorAll(".motion-word")
    ).toHaveLength(0)
  })
})

describe("liveSendKey", () => {
  it("names a send only while the newest message is still local", () => {
    expect(liveSendKey(history, null)).toBeNull()
    expect(
      liveSendKey(history, { id: "pending-user", role: "user", text: "Hi" })
    ).toBe("send-2")
    expect(liveSendKey([...history, ask], null)).toBe("send-2")
    expect(
      liveSendKey(
        [...history, { id: "user-2", role: "user", text: "Shorten it" }],
        null
      )
    ).toBeNull()
  })
})
