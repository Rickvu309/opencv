export type AgentCopy = {
  id: string
  label: string
  button: string
  format: "shell" | "toml" | "json" | "note"
  text: string
}

export type AgentSnippet = {
  id: "claude" | "cursor" | "codex" | "chatgpt"
  title: string
  detail: string
  more?: { title: string; body: string }
  copies: AgentCopy[]
}

const AGENT_CAPABILITY =
  "Consent lists what the agent can use. Approve one that includes documents to let it work on your CVs and Letters. A connection made for Jobs only stays that way, so connect again to add documents. The agent reads a document with paper_read and proposes changes with paper_edit."

export function mcpResourceUrl(value: string) {
  const url = new URL(value)
  url.pathname = "/mcp"
  url.search = ""
  url.hash = ""
  return url.href
}

export function agentSnippets(serverUrl: string): AgentSnippet[] {
  const url = mcpResourceUrl(serverUrl)
  return [
    {
      id: "claude",
      title: "Claude Code",
      detail:
        "Add the server, then sign in. Nothing changes until you approve it in OpenCV.",
      more: {
        title: "What the agent can do",
        body: `You can also sign in from Claude Code with /mcp. ${AGENT_CAPABILITY}`,
      },
      copies: [
        {
          id: "claude-add",
          label: "Add the server",
          button: "Copy Claude add command",
          format: "shell",
          text: `claude mcp add --transport http opencv ${url}`,
        },
        {
          id: "claude-login",
          label: "Sign in",
          button: "Copy Claude login command",
          format: "shell",
          text: "claude mcp login opencv",
        },
      ],
    },
    {
      id: "cursor",
      title: "Cursor",
      detail:
        "Merge the opencv entry into ~/.cursor/mcp.json, or into .cursor/mcp.json for one project. Keep the other servers already in that file.",
      copies: [
        {
          id: "cursor",
          label: "Merge this entry",
          button: "Copy Cursor entry",
          format: "json",
          text: JSON.stringify({ mcpServers: { opencv: { url } } }, null, 2),
        },
      ],
    },
    {
      id: "codex",
      title: "Codex",
      detail:
        "Add the table, then sign in. Nothing changes until you approve it in OpenCV.",
      more: {
        title: "What the agent can do",
        body: AGENT_CAPABILITY,
      },
      copies: [
        {
          id: "codex-table",
          label: "Add to ~/.codex/config.toml",
          button: "Copy Codex table",
          format: "toml",
          text: `[mcp_servers.opencv]\nurl = "${url}"\nauth = "oauth"\n`,
        },
        {
          id: "codex-login",
          label: "Sign in",
          button: "Copy Codex login command",
          format: "shell",
          text: "codex mcp login opencv",
        },
      ],
    },
    {
      id: "chatgpt",
      title: "ChatGPT on the web",
      detail: "Add this address as a plugin for an existing remote server.",
      copies: [
        {
          id: "chatgpt",
          label: "Plugin address",
          button: "Copy ChatGPT on the web",
          format: "note",
          text: `Add this address as a plugin that points at an existing remote server:\n${url}`,
        },
      ],
    },
  ]
}
