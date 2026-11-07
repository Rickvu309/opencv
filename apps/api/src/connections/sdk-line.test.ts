import { createRequire } from "node:module"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)

function declared(field: "dependencies" | "devDependencies", name: string) {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  ) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  return pkg[field][name]
}

function packageOf(name: string) {
  let dir = dirname(require.resolve(name))
  for (;;) {
    const file = join(dir, "package.json")
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as {
        name?: string
        version: string
        peerDependencies?: Record<string, string>
      }
      if (pkg.name === name) return pkg
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`missing ${name}`)
}

function installed(name: string) {
  return packageOf(name).version
}

function accepts(version: string, range: string) {
  const pin = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  const caret = /^\^(\d+)\.(\d+)\.\d+$/.exec(range)
  if (!pin || !caret) return false
  const [major, minor] = [Number(pin[1]), Number(pin[2])]
  const [wantMajor, wantMinor] = [Number(caret[1]), Number(caret[2])]
  return major === wantMajor && minor >= wantMinor
}

describe("the agent talk library", () => {
  it("keeps the server, the client, and the Hono adapter on one line", () => {
    const server = declared("dependencies", "@modelcontextprotocol/server")
    const client = declared("devDependencies", "@modelcontextprotocol/client")
    const hono = declared("dependencies", "@modelcontextprotocol/hono")
    expect(server).toBe(client)
    expect(server).toMatch(/^2\.4\.\d+$/)
    expect(installed("@modelcontextprotocol/server")).toBe(server)
    expect(installed("@modelcontextprotocol/client")).toBe(client)
    expect(installed("@modelcontextprotocol/hono")).toBe(hono)
    const peer =
      packageOf("@modelcontextprotocol/hono").peerDependencies?.[
        "@modelcontextprotocol/server"
      ] ?? ""
    expect(accepts(server, peer)).toBe(true)
  })
})
