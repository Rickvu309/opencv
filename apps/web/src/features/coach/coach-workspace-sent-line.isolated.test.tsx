import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import { chatApiFetch, scriptCoachStream } from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) =>
      (await chatApiFetch(input, init)) ??
      (await profileApiFetch(input, init)) ??
      new Response("{}", { status: 404 })
  )
})

describe("pending send in the workspace", () => {
  function log() {
    return screen.getByRole("log", { name: "Chat" })
  }

  async function sendLine(text: string) {
    const box = await screen.findByRole("textbox", { name: "Message Coach" })
    await waitFor(() => expect(box).toBeEnabled())
    fireEvent.change(box, { target: { value: text } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
  }

  async function turnSettled() {
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Stop" })
      ).not.toBeInTheDocument()
    )
  }

  it("does not bring a finished send back into an empty compact chat", async () => {
    scriptCoachStream({ texts: ["Noted."] })
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    await sendLine("Remember the old line")
    expect(await screen.findByText("Noted.")).toBeVisible()
    await turnSettled()
    expect(within(log()).getAllByText("Remember the old line")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    await waitFor(() =>
      expect(
        screen.queryByText("Remember the old line")
      ).not.toBeInTheDocument()
    )
    expect(screen.queryByText("Noted.")).not.toBeInTheDocument()
  })

  it("keeps one bubble when Enter is pressed twice, then accepts a second turn", async () => {
    const stream = scriptCoachStream({ gated: true, texts: ["First answer"] })
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    const box = await screen.findByRole("textbox", { name: "Message Coach" })
    await waitFor(() => expect(box).toBeEnabled())
    fireEvent.change(box, { target: { value: "First" } })
    fireEvent.keyDown(box, { key: "Enter" })
    fireEvent.keyDown(box, { key: "Enter" })
    expect(within(log()).getAllByText("First")).toHaveLength(1)
    stream.releaseAll()
    expect(await screen.findByText("First answer")).toBeVisible()
    await turnSettled()
    scriptCoachStream({ texts: ["Second answer"] })
    await sendLine("Second")
    expect(within(log()).getAllByText("Second")).toHaveLength(1)
    expect(await screen.findByText("Second answer")).toBeVisible()
    await turnSettled()
    expect(within(log()).getAllByText("First")).toHaveLength(1)
    expect(within(log()).getAllByText("Second")).toHaveLength(1)
  })

  it("drops a failed send from the next chat", async () => {
    scriptCoachStream({ streamError: "The model failed." })
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    await sendLine("This turn failed")
    expect(await screen.findByRole("alert")).toBeVisible()
    await turnSettled()
    expect(within(log()).getAllByText("This turn failed")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    await waitFor(() =>
      expect(screen.queryByText("This turn failed")).not.toBeInTheDocument()
    )
  })

  it("drops a stopped send from the next chat", async () => {
    const stream = scriptCoachStream({ gated: true, texts: ["Still going"] })
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    await sendLine("Stop this line")
    expect(await within(log()).findByText("Stop this line")).toBeVisible()
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }))
    await turnSettled()
    expect(within(log()).getAllByText("Stop this line")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "New chat" }))
    await waitFor(() =>
      expect(screen.queryByText("Stop this line")).not.toBeInTheDocument()
    )
    stream.releaseAll()
  })

  it("does not carry a send into another chat", async () => {
    scriptCoachStream({ texts: ["Noted."] })
    render(
      <ChatStoreProvider>
        <CoachWorkspace presentation="compact" />
      </ChatStoreProvider>
    )
    await sendLine("Only in this chat")
    expect(await screen.findByText("Noted.")).toBeVisible()
    await turnSettled()
    fireEvent.click(screen.getByRole("button", { name: /History,/ }))
    fireEvent.click(
      await screen.findByRole("button", { name: /CV vs internship first/ })
    )
    expect(
      await within(log()).findByText(
        "I don't know if I should chase internships or finish my CV first."
      )
    ).toBeVisible()
    expect(
      within(log()).queryByText("Only in this chat")
    ).not.toBeInTheDocument()
  })
})
