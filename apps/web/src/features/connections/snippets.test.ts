import { spawnSync } from "node:child_process"
import { expect, it } from "vitest"
import { agentSnippets, mcpResourceUrl, type AgentCopy } from "./snippets.ts"

const address = "https://api.opencv.me/mcp"

function commandArgs(text: string) {
  expect(text).toBe(text.trim())
  expect(text).not.toMatch(/[\n\r;&|]/)
  const args: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null
      else current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === " ") {
      if (current) args.push(current)
      current = ""
      continue
    }
    current += char
  }
  expect(quote).toBeNull()
  if (current) args.push(current)
  expect(args.length).toBeGreaterThan(0)
  return args
}

function parseToml(text: string) {
  const parsed = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))",
    ],
    { input: text, encoding: "utf8" }
  )
  expect(parsed.status, parsed.stderr).toBe(0)
  return JSON.parse(parsed.stdout) as {
    mcp_servers: { opencv: { url: string; auth: string } }
  }
}

function copy(snippetId: string, copyId: string): AgentCopy {
  const snippet = agentSnippets("https://api.opencv.me/other").find(
    (item) => item.id === snippetId
  )
  const piece = snippet?.copies.find((item) => item.id === copyId)
  expect(piece).toBeDefined()
  return piece as AgentCopy
}

it("builds a pasteable step for each client from the mcp address", () => {
  expect(mcpResourceUrl("https://api.opencv.me/other?x=1")).toBe(address)
  const snippets = agentSnippets("https://api.opencv.me/other")
  const claude = snippets.find((item) => item.id === "claude")
  const cursor = snippets.find((item) => item.id === "cursor")
  const codex = snippets.find((item) => item.id === "codex")
  const chatgpt = snippets.find((item) => item.id === "chatgpt")

  expect(claude?.detail).toMatch(/\/mcp/)
  expect(commandArgs(copy("claude", "claude-add").text)).toEqual([
    "claude",
    "mcp",
    "add",
    "--transport",
    "http",
    "opencv",
    address,
  ])
  expect(commandArgs(copy("claude", "claude-login").text)).toEqual([
    "claude",
    "mcp",
    "login",
    "opencv",
  ])

  expect(cursor?.detail).toContain("~/.cursor/mcp.json")
  expect(cursor?.detail.match(/\.cursor\/mcp\.json/g)).toHaveLength(2)
  expect(cursor?.detail.toLowerCase()).toContain("merge")
  expect(JSON.parse(copy("cursor", "cursor").text)).toEqual({
    mcpServers: { opencv: { url: address } },
  })

  expect(codex?.detail).toContain("~/.codex/config.toml")
  const table = copy("codex", "codex-table").text
  expect(table).not.toMatch(/codex mcp/)
  expect(parseToml(table).mcp_servers.opencv).toEqual({
    url: address,
    auth: "oauth",
  })
  expect(commandArgs(copy("codex", "codex-login").text)).toEqual([
    "codex",
    "mcp",
    "login",
    "opencv",
  ])

  expect(chatgpt?.copies).toHaveLength(1)
  expect(copy("chatgpt", "chatgpt").text).toContain(
    "plugin that points at an existing remote server"
  )
  expect(copy("chatgpt", "chatgpt").text).toContain(address)
})
