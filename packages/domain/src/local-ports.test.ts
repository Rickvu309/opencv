import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { localDevUrls } from "./local-ports.js"

describe("localDevUrls", () => {
  it("puts the web dev server one above the api port", () => {
    assert.deepEqual(localDevUrls("4402"), {
      apiPort: 4402,
      webPort: 4403,
      apiUrl: "http://localhost:4402",
      webOrigin: "http://localhost:4403",
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
