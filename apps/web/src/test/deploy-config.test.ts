// @vitest-environment node
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRailwayContext, project } from "railway/iac"
import { describe, expect, it } from "vitest"

import railwayConfig, { partial } from "../../../../.railway/railway"

async function railwayResources(environment: string) {
  const definition = await railwayConfig(
    createRailwayContext({ environment }),
    project
  )
  return definition.resources?.flat() ?? []
}

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")

const hostedRepo = () => {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  const url = execFileSync("git", ["config", "--get", "remote.origin.url"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim()
  return url.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "")
}

const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8")

describe("the web Caddyfile serves the SPA, /health and /version.txt, and caches by asset type", () => {
  const caddyfile = read("apps/web/Caddyfile")

  it("serves the SPA with a fallback to index.html and a /health handler", () => {
    expect(caddyfile).toContain("auto_https off")
    expect(caddyfile).toContain("try_files {path} /index.html")
    expect(caddyfile).toMatch(/handle \/health[\s\S]*respond "ok" 200/)
    expect(caddyfile).toContain("file_server")
  })

  it("serves /version.txt uncached so a deploy check never reads a stale sha", () => {
    expect(caddyfile).toMatch(
      /handle \/version\.txt \{\s*header Cache-Control "no-store"\s*file_server/
    )
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

  it("declares RAILWAY_GIT_COMMIT_SHA and writes it, or unknown, into dist/version.txt", () => {
    const arg = lines.findIndex(
      (line) => line.trim() === "ARG RAILWAY_GIT_COMMIT_SHA"
    )
    const write = lines.findIndex((line) =>
      line.includes("apps/web/dist/version.txt")
    )
    const build = lines.findIndex((line) =>
      line.includes("pnpm turbo build --filter=web")
    )

    expect(arg).toBeGreaterThan(build)
    expect(write).toBeGreaterThan(arg)
    expect(lines[write]).toContain("${RAILWAY_GIT_COMMIT_SHA:-unknown}")
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
    async (environment) => {
      const resources = await railwayResources(environment)
      const api = resources
        ?.filter((resource) => resource.type === "service")
        .find((resource) => resource.name === "api")

      expect(partial).toBe("opencv-apps")
      expect(resources?.map((resource) => resource.address)).toEqual([
        "service.api",
        "service.web",
      ])
      expect(api).toMatchObject({
        source: { type: "github", repo: "Rickvu309/opencv", branch: "main" },
        deploy: { preDeployCommand: ["pnpm --filter api run migrate"] },
      })
      expect(api?.variables).toEqual({
        ANTHROPIC_API_KEY: { type: "preserve" },
        AUTH_EMAIL_FROM: { type: "preserve" },
        AUTH_URL: { type: "preserve" },
        DATABASE_URL: { type: "preserve" },
        GOOGLE_CLIENT_ID: { type: "preserve" },
        GOOGLE_CLIENT_SECRET: { type: "preserve" },
        NIXPACKS_NODE_VERSION: { type: "literal", value: "24" },
        RESEND_API_KEY: { type: "preserve" },
        SESSION_SECRET: { type: "preserve" },
        WEB_ORIGINS: { type: "preserve" },
      })
    }
  )

  it.each([
    ["staging", "https://api-staging.opencv.me"],
    ["production", "https://api.opencv.me"],
  ])("points %s's web build at its own api", async (environment, apiUrl) => {
    const web = (await railwayResources(environment)).find(
      (resource) => resource.address === "service.web"
    )

    expect(web).toMatchObject({
      source: { type: "github", repo: "Rickvu309/opencv", branch: "main" },
      build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
      deploy: { healthcheckPath: "/health" },
      variables: { VITE_API_URL: { type: "literal", value: apiUrl } },
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

  it("builds both services from the repository that hosts this code", async () => {
    const sources = (await railwayResources("production")).map(
      (resource) => (resource as { source?: { repo?: string } }).source?.repo
    )

    expect(sources).toHaveLength(2)
    for (const repo of sources ?? [])
      expect(repo?.toLowerCase()).toBe(hostedRepo().toLowerCase())
  })
})

describe("Coach deployment mode", () => {
  it("uses one runtime API kill switch without a web build flag", () => {
    const env = read(".env.example")
    expect(env).toContain("COACH_DURABLE=on")
    expect(env).not.toContain("VITE_COACH_TASK_WORKER")
    expect(env).not.toContain("COACH_TASK_WORKER=")
    expect(env).not.toContain("COACH_EMBEDDED_WORKER=")
    expect(read("apps/api/src/platform/config.ts")).toContain(
      'return env.COACH_DURABLE?.trim().toLowerCase() !== "off"'
    )
    expect(read("apps/api/src/app.ts")).toContain(
      'c.header("Cache-Control", "no-store")'
    )
    expect(read("apps/web/src/features/coach/use-coach-turn.ts")).toContain(
      "queryFn: getCoachConfig"
    )
    expect(read("apps/web/src/features/coach/use-coach-turn.ts")).not.toContain(
      "VITE_COACH"
    )
  })
})
