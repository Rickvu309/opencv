// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRailwayContext } from "railway/iac"
import { describe, expect, it } from "vitest"

import railwayConfig, { partial } from "../../../../.railway/railway"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")

const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8")

describe("apps/web/Caddyfile", () => {
  const caddyfile = read("apps/web/Caddyfile")

  it("serves the SPA with a fallback to index.html and a /health handler", () => {
    expect(caddyfile).toContain("auto_https off")
    expect(caddyfile).toContain("try_files {path} /index.html")
    expect(caddyfile).toMatch(/handle \/health[\s\S]*respond "ok" 200/)
    expect(caddyfile).toContain("file_server")
  })

  it("caches hashed assets forever and never caches index.html", () => {
    expect(caddyfile).toMatch(
      /handle \/assets\/\*[\s\S]*immutable[\s\S]*match status 2xx/
    )
    expect(caddyfile).toMatch(/handle \{\s*header Cache-Control "no-cache"/)
  })
})

describe("apps/web/Dockerfile", () => {
  const dockerfile = read("apps/web/Dockerfile")
  const lines = dockerfile.split("\n")

  it("ships a same-origin client without a separate API build URL", () => {
    expect(dockerfile).not.toContain("VITE_API_URL")
  })

  it("builds with the frozen lockfile and ships dist next to the Caddyfile", () => {
    expect(dockerfile).toContain(
      "pnpm install --frozen-lockfile && pnpm turbo build --filter=web"
    )
    expect(lines.filter((line) => line.startsWith("FROM "))).toHaveLength(2)
    expect(dockerfile).toContain("/app/apps/web/dist /srv")
    expect(dockerfile).toContain("apps/web/Caddyfile /etc/caddy/Caddyfile")
  })
})

describe(".railway/railway.ts", () => {
  const railway = read(".railway/railway.ts")

  it("rebuilds web only when something web reads changes", () => {
    for (const watched of [
      "apps/web/**",
      "packages/ui/**",
      "packages/domain/**",
      "pnpm-lock.yaml",
    ]) {
      expect(railway).toContain(watched)
    }
    expect(railway).toContain('dockerfilePath: "apps/web/Dockerfile"')
  })

  it.each(["staging", "production"])(
    "scopes %s ownership to application services and retains API source and variables",
    (environment) => {
      const resources = railwayConfig(
        createRailwayContext({ environment })
      ).resources?.flat()
      const api = resources
        ?.filter((resource) => resource.type === "service")
        .find((resource) => resource.name === "api")

      expect(partial).toBe("opencv-apps")
      expect(resources?.map((resource) => resource.address)).toEqual([
        "service.api",
        "service.web",
      ])
      expect(api).toMatchObject({
        source: { type: "github", repo: "quanvu309/opencv", branch: "main" },
        deploy: { preDeployCommand: ["pnpm --filter api run migrate"] },
      })
      expect(api?.variables).toEqual({
        PORT: { type: "literal", value: "3001" },
        AUTH_URL: { type: "preserve" },
        DATABASE_URL: { type: "preserve" },
        OPENROUTER_API_KEY: { type: "preserve" },
        SESSION_SECRET: { type: "preserve" },
        WEB_ORIGINS: { type: "preserve" },
      })
    }
  )

  it("routes web API requests through the private API network", () => {
    const web = railwayConfig(
      createRailwayContext({ environment: "production" })
    )
      .resources?.flat()
      .find((resource) => resource.address === "service.web")
    expect(web).toMatchObject({
      source: { type: "github", repo: "quanvu309/opencv", branch: "main" },
      build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
      deploy: { healthcheckPath: "/health" },
      variables: {
        API_UPSTREAM: {
          type: "literal",
          value: "http://api.railway.internal:3001",
        },
      },
    })
  })
})

describe(".env.example", () => {
  it("documents every VITE_ variable the web app reads", () => {
    const envExample = readFileSync(path.join(repoRoot, ".env.example"), "utf8")
    const documented = new Set(envExample.match(/VITE_[A-Z0-9_]+/g) ?? [])

    const srcDir = path.join(webRoot, "src")
    const used = new Set(
      readdirSync(srcDir, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .flatMap(
          (file) =>
            readFileSync(path.join(srcDir, file), "utf8").match(
              /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g
            ) ?? []
        )
    )

    for (const reference of used) {
      expect(documented).toContain(reference.replace("import.meta.env.", ""))
    }
    expect(used.size).toBeGreaterThan(0)
  })
})
