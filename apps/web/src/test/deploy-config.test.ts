// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

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

  it("bakes VITE_API_URL into the build before the build command runs", () => {
    const arg = lines.findIndex((line) => line.trim() === "ARG VITE_API_URL")
    const build = lines.findIndex((line) =>
      line.includes("pnpm turbo build --filter=web")
    )

    expect(arg).toBeGreaterThan(-1)
    expect(build).toBeGreaterThan(arg)
    expect(dockerfile).toContain("ENV VITE_API_URL=$VITE_API_URL")
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

  it("keeps the api pre-deploy migration and leaves the hand-flipped vars out", () => {
    expect(railway).toContain("pnpm --filter api run migrate")
    expect(railway).not.toMatch(/^\s*(AUTH_URL|WEB_ORIGINS)\s*:/m)
  })

  it("points each environment's web build at its own api", () => {
    expect(railway).toContain("https://api.opencv.me")
    expect(railway).toContain("https://api-staging.opencv.me")
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
