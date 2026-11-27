import { useReducer } from "react"
import { Button } from "@workspace/ui/components/button"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import {
  chatApiFetch,
  chatCreateCalls,
  getLastCoachRequest,
  getMockChats,
  scriptCoachStream,
  setMockChats,
} from "@/test/chat-api-mock.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { TEST_NOW } from "@/test/test-clock.ts"
import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"
import { useChatStore } from "./use-chat-store.ts"

const CHAT_A = "11111111-1111-4111-8111-111111111111"
const CHAT_C = "22222222-2222-4222-8222-222222222222"
const LINK = "https://jobs.example.com/role"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
}))

async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
  return (
    (await chatApiFetch(input, init)) ??
    (await profileApiFetch(input, init)) ??
    new Response("{}", { status: 404 })
  )
}

function creationRequest(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input)
  return url.endsWith("/api/commands/chat.create")
}

beforeEach(() => {
  setMockChats([
    { id: CHAT_A, title: "Saved A" },
    { id: CHAT_C, title: "Saved C" },
  ])
  scriptCoachStream({ texts: ["Draft received."] })
  vi.stubGlobal("fetch", mockFetch)
})

afterEach(() => vi.unstubAllGlobals())

type PanelState = { mounted: boolean; open: boolean; chatId: string | null }
type PanelAction = { type: "opened" } | { type: "closed" }

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  return action.type === "opened"
    ? { mounted: true, open: true, chatId: CHAT_A }
    : { ...state, open: false }
}

function Workspaces({
  compactInitially = false,
}: {
  compactInitially?: boolean
}) {
  const store = useChatStore()
  const [panel, dispatch] = useReducer(panelReducer, {
    mounted: compactInitially,
    open: compactInitially,
    chatId: null,
  })
  return (
    <>
      <Button onClick={() => dispatch({ type: "opened" })}>
        Open saved A in panel
      </Button>
      <Button onClick={() => dispatch({ type: "closed" })}>Close panel</Button>
      <Button onClick={() => store.openChat(CHAT_A)}>Select saved A</Button>
      <Button onClick={() => store.openChat(CHAT_C)}>Select saved C</Button>
      <Button onClick={store.newChat}>Select new chat</Button>
      <section aria-label="Main composer">
        <CoachWorkspace />
      </section>
      {panel.mounted ? (
        <section aria-label="Compact composer" hidden={!panel.open}>
          <CoachWorkspace presentation="compact" chatId={panel.chatId} />
        </section>
      ) : null}
    </>
  )
}

function mount(compactInitially = false) {
  render(
    <ChatStoreProvider>
      <Workspaces compactInitially={compactInitially} />
    </ChatStoreProvider>
  )
}

function harnessControl(label: string) {
  return screen.getByText(label, { selector: "button" })
}

function main() {
  return within(screen.getByLabelText("Main composer"))
}

function compact() {
  return within(screen.getByLabelText("Compact composer"))
}

function typeMain(value: string) {
  fireEvent.change(main().getByRole("textbox", { name: "Message Coach" }), {
    target: { value },
  })
}

async function attachLink() {
  fireEvent.click(main().getByRole("button", { name: "Add" }))
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Paste a job link" })
  )
  fireEvent.change(await screen.findByRole("textbox", { name: "Link URL" }), {
    target: { value: LINK },
  })
  fireEvent.click(screen.getByRole("button", { name: "Attach link" }))
  await waitFor(() =>
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
  )
}

async function settled() {
  await waitFor(() =>
    expect(main().getByRole("button", { name: "Send" })).toBeInTheDocument()
  )
}

describe("Coach draft ownership", () => {
  it("recovers a new main draft after opening a saved panel chat and sends it to a separate chat", async () => {
    mount()
    await main().findByRole("textbox", { name: "Message Coach" })
    typeMain("Keep this new conversation separate")
    await attachLink()
    const saved = structuredClone(
      getMockChats().find((chat) => chat.id === CHAT_A)
    )
    expect(saved?.createdAt).toBe(TEST_NOW.toISOString())
    fireEvent.click(harnessControl("Open saved A in panel"))
    await compact().findByRole("button", { name: "History, Saved A" })
    await waitFor(() =>
      expect(
        main().getByRole("textbox", { name: "Message Coach" })
      ).toHaveValue("")
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
    fireEvent.click(harnessControl("Close panel"))
    fireEvent.click(harnessControl("Select new chat"))
    await waitFor(() =>
      expect(
        main().getByRole("textbox", { name: "Message Coach" })
      ).toHaveValue("Keep this new conversation separate")
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    fireEvent.click(main().getByRole("button", { name: "Send" }))
    await waitFor(() =>
      expect(getLastCoachRequest()?.text).toBe(
        "Keep this new conversation separate"
      )
    )
    expect(getLastCoachRequest()?.chatId).not.toBe(CHAT_A)
    expect(getLastCoachRequest()?.context).toEqual([{ kind: "link", id: LINK }])
    expect(chatCreateCalls()).toHaveLength(1)
    expect(getMockChats().find((chat) => chat.id === CHAT_A)).toEqual(saved)
    await settled()
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    fireEvent.click(harnessControl("Select new chat"))
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
  })

  it("restores independent drafts and links when returning from saved C to saved A", async () => {
    mount()
    fireEvent.click(harnessControl("Select saved A"))
    await main().findByRole("button", { name: "History, Saved A" })
    typeMain("Draft for A")
    await attachLink()
    fireEvent.click(harnessControl("Select saved C"))
    await main().findByRole("button", { name: "History, Saved C" })
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
    typeMain("Draft for C")
    fireEvent.click(harnessControl("Select saved A"))
    await waitFor(() =>
      expect(
        main().getByRole("textbox", { name: "Message Coach" })
      ).toHaveValue("Draft for A")
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    fireEvent.click(harnessControl("Select saved C"))
    await waitFor(() =>
      expect(
        main().getByRole("textbox", { name: "Message Coach" })
      ).toHaveValue("Draft for C")
    )
  })

  it("keeps a passive new draft separate from the chat created by another composer", async () => {
    mount(true)
    typeMain("Unsent main draft")
    await attachLink()
    fireEvent.change(
      compact().getByRole("textbox", { name: "Message Coach" }),
      { target: { value: "Panel sends first" } }
    )
    fireEvent.click(compact().getByRole("button", { name: "Send" }))
    await waitFor(() =>
      expect(getLastCoachRequest()?.text).toBe("Panel sends first")
    )
    await settled()
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
    expect(getLastCoachRequest()?.context).toBeUndefined()
    fireEvent.click(harnessControl("Select new chat"))
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Unsent main draft"
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    expect(
      compact().getByRole("textbox", { name: "Message Coach" })
    ).toHaveValue("")
  })

  it("retains first-send context and the next draft through creation failure and Retry", async () => {
    let failed = false
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (creationRequest(input) && !failed) {
          failed = true
          return Response.json(
            {
              ok: false,
              error: { code: "INTERNAL_ERROR", message: "Create failed" },
            },
            { status: 503 }
          )
        }
        return mockFetch(input, init)
      }
    )
    mount()
    typeMain("First request")
    await attachLink()
    fireEvent.click(main().getByRole("button", { name: "Send" }))
    await main().findByRole("button", { name: "Retry" })
    typeMain("Follow-up after failure")
    fireEvent.click(main().getByRole("button", { name: "Retry" }))
    await waitFor(() =>
      expect(getLastCoachRequest()?.text).toBe("First request")
    )
    await settled()
    expect(getLastCoachRequest()?.context).toEqual([{ kind: "link", id: LINK }])
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Follow-up after failure"
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    fireEvent.click(harnessControl("Select new chat"))
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
  })

  it("keeps a failed sender's next draft separate when another composer creates a chat", async () => {
    let failed = false
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (creationRequest(input) && !failed) {
          failed = true
          return Response.json(
            {
              ok: false,
              error: { code: "INTERNAL_ERROR", message: "Create failed" },
            },
            { status: 503 }
          )
        }
        return mockFetch(input, init)
      }
    )
    mount(true)
    typeMain("Main create fails")
    await attachLink()
    fireEvent.click(main().getByRole("button", { name: "Send" }))
    await main().findByRole("button", { name: "Retry" })
    typeMain("Keep my main follow-up private")
    fireEvent.change(
      compact().getByRole("textbox", { name: "Message Coach" }),
      { target: { value: "Panel creates instead" } }
    )
    fireEvent.click(compact().getByRole("button", { name: "Send" }))
    await waitFor(() =>
      expect(getLastCoachRequest()?.text).toBe("Panel creates instead")
    )
    await settled()
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
    expect(
      main().queryByRole("button", { name: "Remove jobs.example.com/role" })
    ).not.toBeInTheDocument()
    expect(getLastCoachRequest()?.context).toBeUndefined()
    fireEvent.click(harnessControl("Select new chat"))
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Keep my main follow-up private"
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    expect(
      compact().getByRole("textbox", { name: "Message Coach" })
    ).toHaveValue("")
  })

  it("keeps text typed during creation with its initiating conversation", async () => {
    let release: () => void = () => undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let creating = false
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (creationRequest(input)) {
          creating = true
          await pending
        }
        return mockFetch(input, init)
      }
    )
    mount()
    typeMain("Create my chat")
    await attachLink()
    fireEvent.click(main().getByRole("button", { name: "Send" }))
    await waitFor(() => expect(creating).toBe(true))
    typeMain("Next message while creating")
    await act(async () => release())
    await waitFor(() =>
      expect(getLastCoachRequest()?.text).toBe("Create my chat")
    )
    await settled()
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Next message while creating"
    )
    expect(
      main().getByRole("button", { name: "Remove jobs.example.com/role" })
    ).toBeVisible()
    fireEvent.click(harnessControl("Select new chat"))
    expect(main().getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      ""
    )
  })
})
