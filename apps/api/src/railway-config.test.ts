import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

const apiRoot = fileURLToPath(new URL("..", import.meta.url))
const repoRoot = path.resolve(apiRoot, "../..")

type RailwayConfig = {
  build: { buildCommand?: string; watchPatterns?: string[] }
  deploy: { startCommand?: string; healthcheckPath?: string }
}

describe("railway.json (api service)", () => {
  const config: RailwayConfig = JSON.parse(
    readFileSync(path.join(repoRoot, "railway.json"), "utf8")
  )

  it("builds and starts the api workspace package", () => {
    expect(config.build.buildCommand).toContain("--filter api run build")
    expect(config.deploy.startCommand).toContain("--filter api run start")
  })

  it("healthchecks the route the API actually serves", async () => {
    expect(config.deploy.healthcheckPath).toBe("/health")

    const res = await createApp({ webOrigins: [] }).request("/health")
    expect(res.status).toBe(200)
  })

  it("only watches paths that can affect the api build", () => {
    const patterns = config.build.watchPatterns ?? []
    expect(patterns).toContain("apps/api/**")
    expect(patterns).toContain("pnpm-lock.yaml")
    expect(patterns).not.toContain("apps/web/**")
  })
})
