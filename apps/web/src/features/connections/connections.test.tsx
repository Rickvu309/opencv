import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { connectionIdSchema } from "@workspace/domain"
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  answerConsent,
  consentClient,
  fetchConnections,
} from "@/lib/connections-api.ts"
const { runCommand } = vi.hoisted(() => ({ runCommand: vi.fn() }))
import { ConnectionConsent } from "./consent.tsx"
import { ConnectionList } from "./connection-list.tsx"

vi.mock("@/lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({ data: { user: { email: "owner@example.com" } } }),
  },
}))

vi.mock("@/lib/connections-api.ts", () => ({
  agentServerUrl: "http://localhost:4107/mcp",
  connectionsKey: () => ["connections.list"],
  consentKey: (value: string) => ["consent", value],
  fetchConnections: vi.fn(),
  consentClient: vi.fn(),
  answerConsent: vi.fn(),
}))
vi.mock("@/lib/contract-client.ts", () => ({ runContractCommand: runCommand }))

function show(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>)
  return client
}

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(
    {},
    "",
    "/oauth/consent?client_id=agent&sig=verified"
  )
})
afterEach(cleanup)

it("labels the app-supplied name as unverified and sends cancellation through the provider", async () => {
  vi.mocked(consentClient).mockResolvedValue({
    client_id: "agent",
    client_name: "My agent",
  })
  vi.mocked(answerConsent).mockRejectedValue(new Error("Unavailable"))
  show(<ConnectionConsent />)
  expect(
    await screen.findByRole("heading", { name: "Connect this agent?" })
  ).toBeInTheDocument()
  expect(
    await screen.findByText("App-supplied name (unverified)")
  ).toBeInTheDocument()
  expect(screen.getByText("My agent")).toBeInTheDocument()
  expect(screen.getByText("Client identifier")).toBeInTheDocument()
  expect(screen.getByText("agent")).toBeInTheDocument()
  expect(
    screen.getByText(/Data your agent reads leaves OpenCV/)
  ).toBeInTheDocument()
  expect(
    screen.getByText("Connecting as owner@example.com")
  ).toBeInTheDocument()
  expect(screen.getByText(/Access tokens last 1 hour/)).toHaveTextContent(
    "30 days"
  )
  expect(
    screen.getByText(/Your agent can read all your current and future Jobs/)
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  await waitFor(() =>
    expect(answerConsent).toHaveBeenCalledWith(
      "client_id=agent&sig=verified",
      false
    )
  )
  expect(await screen.findByRole("alert")).toBeInTheDocument()
})

it("keeps approval disabled for an unverified or loading request", async () => {
  vi.mocked(consentClient).mockRejectedValue(new Error("Bad signature"))
  show(<ConnectionConsent />)
  expect(
    screen.getByRole("button", { name: "Allow connection" })
  ).toBeDisabled()
  await screen.findByRole("alert")
  expect(
    screen.getByRole("button", { name: "Allow connection" })
  ).toBeDisabled()
  expect(answerConsent).not.toHaveBeenCalled()
})

it("copies a ready command for each agent", async () => {
  vi.mocked(fetchConnections).mockResolvedValue([])
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  show(<ConnectionList />)
  expect(
    await screen.findByRole("heading", { name: "Connect an agent" })
  ).toBeInTheDocument()
  expect(screen.getByText("http://localhost:4107/mcp")).toBeInTheDocument()
  const claude = screen.getByRole("button", { name: "Copy Claude Code" })
  fireEvent.click(claude)
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "claude mcp add --transport http opencv http://localhost:4107/mcp"
    )
  )
  expect(claude).toHaveAttribute("data-state", "copied")
  fireEvent.click(screen.getByRole("button", { name: "Copy Cursor" }))
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"url": "http://localhost:4107/mcp"')
    )
  )
  fireEvent.click(screen.getByRole("button", { name: "Copy Codex" }))
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('auth = "oauth"')
    )
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Copy ChatGPT on the web" })
  )
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("plugin that points at an existing remote server")
    )
  )
})

it("renders empty connections and a retriable load failure", async () => {
  vi.mocked(fetchConnections)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue([])
  show(<ConnectionList />)
  expect(screen.getByRole("status")).toHaveTextContent("Loading connections")
  await screen.findByRole("alert")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByText("No agents connected.")).toBeInTheDocument()
})

it.each(["none", "jobs"] as const)(
  "revokes a %s grant through the registry and reflects the live connection",
  async (kind) => {
    const connection = {
      id: connectionIdSchema.parse("11070000-0000-4000-8000-000000000001"),
      clientId: "agent",
      name: "Long agent name ".repeat(12),
      audience: "http://localhost:4107/mcp",
      scopes: ["connection.status"],
      resources: { kind },
      policy: { reads: "allow" as const, writes: "approval" as const },
      version: 1,
      consentVersion: 1,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      revokedAt: null,
    }
    vi.mocked(fetchConnections).mockResolvedValue([connection])
    runCommand.mockImplementation(async (client: QueryClient) => {
      vi.mocked(fetchConnections).mockResolvedValue([
        { ...connection, revokedAt: new Date().toISOString(), version: 2 },
      ])
      await client.invalidateQueries()
      return { revoked: true }
    })
    const client = show(<ConnectionList />)
    const revokeButton = await screen.findByRole("button", {
      name: "Revoke access",
    })
    for (const label of [
      "Active",
      "Connected",
      "Last used",
      "Never",
      "Expires",
      kind === "jobs"
        ? "All current and future Jobs · Reversible changes need approval"
        : "Connection status only · No documents or Jobs shared",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(document.querySelectorAll("time")).toHaveLength(2)
    fireEvent.click(revokeButton)
    await waitFor(() =>
      expect(runCommand).toHaveBeenCalledWith(client, "connections.revoke", {
        connectionId: connection.id,
      })
    )
    expect(await screen.findByText("Revoked")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Revoke access" })
    ).not.toBeInTheDocument()
  }
)

it("shows the CIMD origin before the unverified app name", async () => {
  vi.mocked(consentClient).mockResolvedValue({
    client_id: "https://agents.example/client.json",
    client_name: "Claude Code",
  })
  show(<ConnectionConsent />)
  const origin = await screen.findByText("https://agents.example")
  const name = screen.getByText("Claude Code")
  expect(screen.getByText("Client metadata origin")).toBeInTheDocument()
  expect(
    origin.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(screen.getByText("App-supplied name (unverified)")).toBeInTheDocument()
})
