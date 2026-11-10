import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import { render } from "@/test/render-with-client.tsx"
import {
  chatApiFetchOrThrow,
  resetChatApiMock,
  scriptCoachStream,
} from "@/test/chat-api-mock.ts"
import { pathOf } from "@/test/mock-http.ts"

import { ChatStoreProvider } from "./chat-store.tsx"
import { useChatStore } from "./use-chat-store.ts"

const CHAT = "11111111-1111-4111-8111-111111111111"
const DOC = "11111111-1111-7111-8111-111111111111"

const turnBodies: Record<string, unknown>[] = []
let release: (() => void) | null = null

function Harness() {
  const store = useChatStore()
  return (
    <>
      <p aria-label="Coach phase">{store.phase}</p>
      <p aria-label="Coach transcript">
        {store.messages.map((message) => message.text).join("\n")}
      </p>
      <button type="button" onClick={() => store.openChat(CHAT)}>
        Open
      </button>
      <button type="button" onClick={() => store.send("Ask off the page")}>
        Send
      </button>
      <button type="button" onClick={() => store.regenerate()}>
        Again
      </button>
    </>
  )
}

function mount() {
  render(
    <ChatStoreProvider>
      <Harness />
    </ChatStoreProvider>
  )
}

async function openSavedChat() {
  fireEvent.click(screen.getByRole("button", { name: "Open" }))
  await waitFor(() => {
    expect(screen.getByLabelText("Coach phase")).toHaveTextContent("idle")
    expect(screen.getByLabelText("Coach transcript")).toHaveTextContent(
      "finish my CV first"
    )
  })
}

async function settle(count: number) {
  await waitFor(() => {
    expect(turnBodies).toHaveLength(count)
    expect(screen.getByLabelText("Coach phase")).toHaveTextContent("idle")
  })
}

beforeEach(() => {
  turnBodies.length = 0
  resetChatApiMock()
  scriptCoachStream({ texts: ["Noted."] })
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase()
      if (method === "POST" && /\/turns$/.test(pathOf(input)) && init?.body) {
        const body: unknown = JSON.parse(String(init.body))
        if (body && typeof body === "object") {
          turnBodies.push(body as Record<string, unknown>)
        }
      }
      return chatApiFetchOrThrow(input, init)
    }
  )
})

afterEach(async () => {
  cleanup()
  release?.()
  release = null
  await act(async () => {})
  vi.unstubAllGlobals()
})

describe("writing page Coach focus", () => {
  it("omits focusDocId when the writing page is closed", async () => {
    mount()
    await openSavedChat()
    fireEvent.click(screen.getByRole("button", { name: "Again" }))
    await settle(1)
    expect(turnBodies[0]).not.toHaveProperty("focusDocId")
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await settle(2)
    expect(turnBodies[1]).toMatchObject({ text: "Ask off the page" })
    expect(turnBodies[1]).not.toHaveProperty("focusDocId")
  })

  it("sends the writing page id only while that page is open", async () => {
    release = holdWritingCoachFocus(DOC)
    mount()
    await openSavedChat()
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await settle(1)
    expect(turnBodies[0]).toMatchObject({
      text: "Ask off the page",
      focusDocId: DOC,
    })
    release()
    release = null
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await settle(2)
    expect(turnBodies[1]).toMatchObject({ text: "Ask off the page" })
    expect(turnBodies[1]).not.toHaveProperty("focusDocId")
  })
})
