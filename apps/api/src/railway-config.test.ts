import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

const apiRoot = fileURLToPath(new URL("..", import.meta.url))
const repoRoot = path.resolve(apiRoot, "../..")

describe(".railway/railway.ts (api service)", () => {
  const config = readFileSync(
    path.join(repoRoot, ".railway/railway.ts"),
    "utf8"
  )

  it("builds workspace dependencies and starts the api package", () => {
    expect(config).toContain("--filter api... run build")
    expect(config).toContain('startCommand: "pnpm --filter api run start"')
  })

  it("applies committed migrations before each rollout", () => {
    expect(config).toContain(
      'preDeployCommand: ["pnpm --filter api run migrate"]'
    )
    expect(config).not.toContain("run seed")

    const deployDocs = readFileSync(
      path.join(repoRoot, "docs/deploy.md"),
      "utf8"
    )
    expect(deployDocs).toMatch(/Migration pipeline/)
    expect(deployDocs).toMatch(/preDeployCommand/)
    expect(deployDocs).toMatch(/run seed/)
  })

  it("healthchecks the route the API actually serves with no db injected", async () => {
    expect(config).toContain('healthcheckPath: "/health"')

    const res = await createApp({ webOrigins: [] }).request("/health")
    expect(res.status).toBe(200)
  })

  it("only watches paths that can affect the api build", () => {
    const apiBlock = config.slice(
      config.indexOf('service("api"'),
      config.indexOf('service("web"')
    )
    expect(apiBlock).toContain('"apps/api/**"')
    expect(apiBlock).toContain('"pnpm-lock.yaml"')
    expect(apiBlock).not.toContain('"apps/web/**"')
  })
})
