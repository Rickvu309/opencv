import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../.."
)

describe("coach deploy docs", () => {
  it("documents the three Railway Coach vars and the 503 posture", () => {
    const envExample = readFileSync(path.join(repoRoot, ".env.example"), "utf8")
    const railway = readFileSync(path.join(repoRoot, "docs/railway.md"), "utf8")
    const deploy = readFileSync(path.join(repoRoot, "docs/deploy.md"), "utf8")

    for (const name of [
      "OPENROUTER_API_KEY",
      "COACH_MODEL",
      "COACH_DAILY_TURN_LIMIT",
    ]) {
      expect(envExample).toContain(name)
      expect(railway).toContain(name)
    }

    expect(envExample).toContain("anthropic/claude-sonnet-4.5")
    expect(envExample).toContain("COACH_DAILY_TURN_LIMIT=50")
    expect(railway).toContain("COACH_UNAVAILABLE")
    expect(railway).toContain("GET /health")
    expect(deploy).toContain("COACH_UNAVAILABLE")
    expect(deploy).toContain("railway.md#coach")
  })

  it("keeps the live smoke script out of CI", () => {
    const apiPkg = JSON.parse(
      readFileSync(path.join(repoRoot, "apps/api/package.json"), "utf8")
    ) as { scripts: Record<string, string> }
    expect(apiPkg.scripts.smoke).toBe("tsx src/coach/smoke.ts")
    expect(apiPkg.scripts.test).not.toMatch(/smoke/)

    const ci = readFileSync(
      path.join(repoRoot, ".github/workflows/ci.yml"),
      "utf8"
    )
    expect(ci).not.toMatch(/filter api smoke|run smoke/)

    const vitest = readFileSync(
      path.join(repoRoot, "apps/api/vitest.config.ts"),
      "utf8"
    )
    expect(vitest).toMatch(/src\/coach\/smoke\.ts/)
  })
})
