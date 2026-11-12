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
    screen.getByText("Connection status only · No documents or Jobs shared")
  ).toBeInTheDocument()
  expect(
    screen.queryByText(/Every change waits for your approval/)
  ).not.toBeInTheDocument()
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
  expect(
    screen.getByText(/Add this table to ~\/\.codex\/config\.toml/)
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Merge the opencv entry into ~\/\.cursor\/mcp\.json/)
  ).toBeInTheDocument()
  const claude = screen.getByRole("button", { name: "Copy Claude add command" })
  fireEvent.click(claude)
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "claude mcp add --transport http opencv http://localhost:4107/mcp"
    )
  )
  expect(claude).toHaveAttribute("data-state", "copied")
  fireEvent.click(
    screen.getByRole("button", { name: "Copy Claude login command" })
  )
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith("claude mcp login opencv")
  )
  fireEvent.click(screen.getByRole("button", { name: "Copy Cursor entry" }))
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"url": "http://localhost:4107/mcp"')
    )
  )
  const codexTable = screen.getByRole("button", { name: "Copy Codex table" })
  fireEvent.click(codexTable)
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const table = writeText.mock.calls.at(-1)?.[0] as string
  expect(table).toContain('auth = "oauth"')
  expect(table).not.toContain("codex mcp")
  fireEvent.click(
    screen.getByRole("button", { name: "Copy Codex login command" })
  )
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith("codex mcp login opencv")
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
        ? "All current and future Jobs · This agent cannot change things"
        : "Connection status only · No documents or Jobs shared",
      "This agent cannot change things",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(
      screen.queryByText("Reads allowed · Writes need approval")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "All current and future Jobs · Every change waits for your approval"
      )
    ).not.toBeInTheDocument()
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

it("says a read-only Jobs connection cannot change things", async () => {
  vi.mocked(fetchConnections).mockResolvedValue([
    {
      id: connectionIdSchema.parse("11070000-0000-4000-8000-000000000002"),
      clientId: "agent",
      name: "Read only",
      audience: "http://localhost:4107/mcp",
      scopes: ["connection.status", "job.read", "offline_access"],
      resources: { kind: "jobs" },
      policy: { reads: "allow", writes: "approval" },
      version: 1,
      consentVersion: 1,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      revokedAt: null,
    },
  ])
  show(<ConnectionList />)
  expect(
    await screen.findByText(
      "All current and future Jobs · This agent cannot change things"
    )
  ).toBeInTheDocument()
  expect(
    screen.getByText("Reads allowed · This agent cannot change things")
  ).toBeInTheDocument()
  expect(
    screen.queryByText("Reads allowed · Writes need approval")
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(
      "All current and future Jobs · Every change waits for your approval"
    )
  ).not.toBeInTheDocument()
})

it.each([
  {
    name: "none",
    id: "11070000-0000-4000-8000-000000000010",
    scopes: ["connection.status", "offline_access"],
    share: "All current and future Jobs · This agent cannot change things",
    access: "This agent cannot change things",
    reads: false,
  },
  {
    name: "read only",
    id: "11070000-0000-4000-8000-000000000011",
    scopes: ["connection.status", "job.read", "offline_access"],
    share: "All current and future Jobs · This agent cannot change things",
    access: "Reads allowed · This agent cannot change things",
    reads: true,
  },
  {
    name: "write only",
    id: "11070000-0000-4000-8000-000000000012",
    scopes: ["connection.status", "job.write", "offline_access"],
    share: "All current and future Jobs · Every change waits for your approval",
    access: "Writes need approval",
    reads: false,
  },
  {
    name: "read plus write",
    id: "11070000-0000-4000-8000-000000000013",
    scopes: ["connection.status", "job.read", "job.write", "offline_access"],
    share: "All current and future Jobs · Every change waits for your approval",
    access: "Reads allowed · Writes need approval",
    reads: true,
  },
])(
  "describes a $name Jobs grant from its scopes",
  async ({ id, scopes, share, access, reads }) => {
    vi.mocked(fetchConnections).mockResolvedValue([
      {
        id: connectionIdSchema.parse(id),
        clientId: "agent",
        name: "Scoped agent",
        audience: "http://localhost:4107/mcp",
        scopes,
        resources: { kind: "jobs" },
        policy: { reads: "allow", writes: "approval" },
        version: 1,
        consentVersion: 1,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        revokedAt: null,
      },
    ])
    show(<ConnectionList />)
    expect(await screen.findByText(share)).toBeInTheDocument()
    expect(screen.getByText(access)).toBeInTheDocument()
    if (!reads) {
      expect(screen.queryByText(/Reads allowed/)).not.toBeInTheDocument()
    }
  }
)

it("keeps approval copy when the connection was granted a write scope", async () => {
  vi.mocked(fetchConnections).mockResolvedValue([
    {
      id: connectionIdSchema.parse("11070000-0000-4000-8000-000000000003"),
      clientId: "agent",
      name: "Can propose",
      audience: "http://localhost:4107/mcp",
      scopes: ["connection.status", "job.read", "job.write", "offline_access"],
      resources: { kind: "jobs" },
      policy: { reads: "allow", writes: "approval" },
      version: 1,
      consentVersion: 1,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      revokedAt: null,
    },
  ])
  show(<ConnectionList />)
  expect(
    await screen.findByText(
      "All current and future Jobs · Every change waits for your approval"
    )
  ).toBeInTheDocument()
  expect(
    screen.getByText("Reads allowed · Writes need approval")
  ).toBeInTheDocument()
})

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

it("names only the job read the agent asked for", async () => {
  const scope =
    "client_id=agent&scope=connection.status%20job.read&sig=verified"
  window.history.replaceState(
    {},
    "",
    `/oauth/consent?oauth_query=${encodeURIComponent(scope)}`
  )
  vi.mocked(consentClient).mockResolvedValue({
    client_id: "agent",
    client_name: "Read only",
  })
  show(<ConnectionConsent />)
  expect(
    await screen.findByText(
      "All current and future Jobs · This agent cannot change things"
    )
  ).toBeInTheDocument()
  expect(
    screen.queryByText(/Every change waits for your approval/)
  ).not.toBeInTheDocument()
  expect(screen.queryByText(/CVs and Letters/)).not.toBeInTheDocument()
})

it("says plainly that documents are shared and every change waits for approval", async () => {
  const scope =
    "client_id=agent&scope=connection.status%20job.read%20job.write%20paper.read%20paper.write&sig=verified"
  window.history.replaceState(
    {},
    "",
    `/oauth/consent?oauth_query=${encodeURIComponent(scope)}`
  )
  vi.mocked(consentClient).mockResolvedValue({
    client_id: "agent",
    client_name: "Paper agent",
  })
  show(<ConnectionConsent />)
  expect(
    await screen.findByText(
      "All current and future Jobs and documents (CVs and Letters) · Every change waits for your approval"
    )
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      /Every proposed change waits for you to approve or deny it/
    )
  ).toBeInTheDocument()
})

it("refuses two consent queries instead of showing one and approving the other", async () => {
  const read = "client_id=agent&scope=connection.status%20job.read&sig=verified"
  const write =
    "client_id=agent&scope=connection.status%20job.read%20job.write&sig=verified"
  window.history.replaceState(
    {},
    "",
    `/oauth/consent?oauth_query=${encodeURIComponent(write)}&oauth_query=${encodeURIComponent(read)}`
  )
  show(<ConnectionConsent />)
  expect(
    await screen.findByText(
      "This connection request could not be verified. Start again from your agent."
    )
  ).toBeInTheDocument()
  expect(
    screen.queryByText(/This agent cannot change things/)
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(/Every change waits for your approval/)
  ).not.toBeInTheDocument()
  expect(consentClient).not.toHaveBeenCalled()
  expect(answerConsent).not.toHaveBeenCalled()
  expect(
    screen.getByRole("button", { name: "Allow connection" })
  ).toBeDisabled()
})

it("offers only documents when that is all the agent asked for", async () => {
  const scope = "client_id=agent&scope=paper.read%20paper.write&sig=verified"
  window.history.replaceState(
    {},
    "",
    `/oauth/consent?oauth_query=${encodeURIComponent(scope)}`
  )
  vi.mocked(consentClient).mockResolvedValue({
    client_id: "agent",
    client_name: "Documents",
  })
  show(<ConnectionConsent />)
  expect(
    await screen.findByText(
      "All current and future documents (CVs and Letters) · Every change waits for your approval"
    )
  ).toBeInTheDocument()
  expect(screen.queryByText(/Jobs/)).not.toBeInTheDocument()
})
