import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const evalDir = fileURLToPath(new URL(".", import.meta.url))
const repoRoot = join(evalDir, "../../../../..")

describe("eval harness is manual-only", () => {
  it("is a dedicated api script and is not in CI or vitest includes", () => {
    const apiPkg = JSON.parse(
      readFileSync(join(repoRoot, "apps/api/package.json"), "utf8")
    ) as { scripts: Record<string, string> }
    expect(apiPkg.scripts.eval).toBe("tsx src/coach/eval/run.ts")
    expect(apiPkg.scripts.test).toBe("vitest run")
    expect(apiPkg.scripts.test).not.toMatch(/eval/)

    const ci = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8")
    expect(ci).toContain("pnpm turbo run lint typecheck test build")
    expect(ci).not.toMatch(/filter api eval|run eval/)

    const vitest = readFileSync(
      join(repoRoot, "apps/api/vitest.config.ts"),
      "utf8"
    )
    expect(vitest).toMatch(/src\/coach\/eval\/run\.ts/)

    const runner = readFileSync(join(evalDir, "run.ts"), "utf8")
    expect(runner).not.toMatch(
      /from\s+["'](ai|@openrouter\/ai-sdk-provider)["']/
    )
    expect(readFileSync(join(evalDir, "judge.ts"), "utf8")).not.toMatch(
      /from\s+["'](ai|@openrouter\/ai-sdk-provider)["']/
    )
  })
})
