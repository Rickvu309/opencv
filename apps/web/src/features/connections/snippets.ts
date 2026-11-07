export type AgentSnippet = {
  id: "claude" | "cursor" | "codex" | "chatgpt"
  title: string
  detail: string
  text: string
}

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
      detail: "Paste this command in a terminal. Then approve the connection.",
      text: `claude mcp add --transport http opencv ${url}`,
    },
    {
      id: "cursor",
      title: "Cursor",
      detail: "Paste this into Cursor. Cursor then asks you to approve.",
      text: JSON.stringify({ mcpServers: { opencv: { url } } }, null, 2),
    },
    {
      id: "codex",
      title: "Codex",
      detail: "Paste this table, then run the login command and approve.",
      text: `[mcp_servers.opencv]\nurl = "${url}"\nauth = "oauth"\n\ncodex mcp login opencv\n`,
    },
    {
      id: "chatgpt",
      title: "ChatGPT on the web",
      detail: "Add this address as a plugin for an existing remote server.",
      text: `Add this address as a plugin that points at an existing remote server:\n${url}`,
    },
  ]
}
