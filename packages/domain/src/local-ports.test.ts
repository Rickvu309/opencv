import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { WORKTREE_PORTS, localDevUrls } from "./local-ports.js"

describe("localDevUrls", () => {
  it("puts the web dev server one above the api port", () => {
    assert.deepEqual(localDevUrls("4402"), {
      apiPort: 4402,
      webPort: 5402,
      apiUrl: "http://localhost:4402",
      webOrigin: "http://localhost:5402",
    })
  })

  it("falls back to 3001 and 5173 without a usable PORT", () => {
    for (const port of [undefined, "", "abc", "0", "70000"]) {
      const urls = localDevUrls(port)
      assert.equal(urls.apiPort, 3001)
      assert.equal(urls.webPort, 5173)
    }
  })
})

describe("worktree port ranges", () => {
  it("keeps every worktree web port clear of every worktree api port", () => {
    const isApiPort = (port: number) =>
      port >= WORKTREE_PORTS.first && port <= WORKTREE_PORTS.last
    for (let port = WORKTREE_PORTS.first; port <= WORKTREE_PORTS.last; port++) {
      const { apiPort, webPort } = localDevUrls(String(port))
      assert.equal(apiPort, port)
      assert.equal(isApiPort(webPort), false)
    }
  })
})
