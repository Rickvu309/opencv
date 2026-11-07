import { expect, it } from "vitest"
import { agentSnippets, mcpResourceUrl } from "./snippets.ts"

const address = "https://api.opencv.me/mcp"

it("builds the four copy texts from the mcp address", () => {
  expect(mcpResourceUrl("https://api.opencv.me/other?x=1")).toBe(address)
  const text = Object.fromEntries(
    agentSnippets("https://api.opencv.me/other").map((snippet) => [
      snippet.id,
      snippet.text,
    ])
  )
  expect(text.claude).toBe(`claude mcp add --transport http opencv ${address}`)
  expect(text.cursor).toBe(
    JSON.stringify({ mcpServers: { opencv: { url: address } } }, null, 2)
  )
  expect(text.codex).toBe(
    `[mcp_servers.opencv]\nurl = "${address}"\nauth = "oauth"\n\ncodex mcp login opencv\n`
  )
  expect(text.chatgpt).toBe(
    `Add this address as a plugin that points at an existing remote server:\n${address}`
  )
})
