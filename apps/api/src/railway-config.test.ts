import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

const apiRoot = fileURLToPath(new URL("..", import.meta.url))
const repoRoot = path.resolve(apiRoot, "../..")

type RailwayConfig = {
  build: { buildCommand?: string; watchPatterns?: string[] }
  deploy: {
    startCommand?: string
    preDeployCommand?: string | string[]
    healthcheckPath?: string
  }
}

describe("railway.json (api service)", () => {
  const config: RailwayConfig = JSON.parse(
    readFileSync(path.join(repoRoot, "railway.json"), "utf8")
  )

  it("builds workspace dependencies and starts the api package", () => {
    expect(config.build.buildCommand).toContain("--filter api...")
    expect(config.deploy.startCommand).toContain("--filter api run start")
  })

  it("applies committed migrations before each rollout", () => {
    const preDeploy = config.deploy.preDeployCommand
    const command = Array.isArray(preDeploy) ? preDeploy.join(" ") : preDeploy
    expect(command).toContain("run migrate")
  })

  it("healthchecks the route the API actually serves with no db injected", async () => {
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
