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
      "COACH_MODEL_FREE",
      "COACH_MODEL_LIGHT",
      "COACH_MODEL_MAX",
      "COACH_DAILY_TURN_LIMIT_FREE",
      "COACH_DAILY_TURN_LIMIT_LIGHT",
      "COACH_DAILY_TURN_LIMIT_MAX",
    ]) {
      expect(envExample).toContain(name)
      expect(railway).toContain(name)
    }

    expect(envExample).toContain("openrouter/free")
    expect(envExample).not.toContain("stealth/ox-alpha")
    expect(railway).toContain("openrouter/free")
    expect(railway).not.toContain("stealth/ox-alpha")
    expect(envExample).toContain("deepseek/deepseek-chat-v3.1")
    expect(envExample).toContain("anthropic/claude-opus-4")
    expect(envExample).toContain("anthropic/claude-fable-5")
    expect(envExample).toContain("COACH_EVAL_MODE")
    expect(railway).toContain("COACH_UNAVAILABLE")
    expect(railway).toContain("GET /health")
    expect(deploy).toContain("COACH_UNAVAILABLE")
    expect(deploy).toContain("railway.md#coach")
  })

  it("does not document the removed variables", () => {
    for (const file of [".env.example", "docs/railway.md"]) {
      const text = readFileSync(path.join(repoRoot, file), "utf8")
      expect(text).not.toContain("COACH_DAILY_TURN_LIMIT=")
      expect(text).not.toMatch(/\| `COACH_MODEL` \||^#\s*COACH_MODEL=/m)
    }
  })

  it("keeps the live smoke script out of the test script", () => {
    const apiPkg = JSON.parse(
      readFileSync(path.join(repoRoot, "apps/api/package.json"), "utf8")
    ) as { scripts: Record<string, string> }
    expect(apiPkg.scripts.smoke).toBe("tsx src/coach/smoke.ts")
    expect(apiPkg.scripts.test).not.toMatch(/smoke/)

    const vitest = readFileSync(
      path.join(repoRoot, "apps/api/vitest.config.ts"),
      "utf8"
    )
    expect(vitest).toMatch(/src\/coach\/smoke\.ts/)
  })
})
