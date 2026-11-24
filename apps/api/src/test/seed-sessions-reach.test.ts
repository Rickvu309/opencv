import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { detect } from "./seed-sessions-reach.js"

const apiRoot = fileURLToPath(new URL("../..", import.meta.url))

const MISTAKES: [string, string][] = [
  [
    "src/paper/store.ts",
    `import { seedSessions } from "../test/seed-sessions.js"\n`,
  ],
  [
    "src/index.ts",
    `const { seedSessions } = await import("./test/seed-sessions.js")\n`,
  ],
  ["src/test/harness.ts", `export * from "./seed-sessions.js"\n`],
  ["src/routes.ts", `import "./test/seed-sessions"\n`],
  ["src/app.ts", `const seed = require("./test/seed-sessions.ts")\n`],
]

const CLEAN: [string, string][] = [
  [
    "src/test/seed-sessions.test.ts",
    `import { seedSessions } from "./seed-sessions.js"\n`,
  ],
  [
    "src/test/seed-sessions-reach.test.ts",
    `import { detect } from "./seed-sessions-reach.js"\n`,
  ],
  [
    "src/test/sweep-stack.ts",
    `const script = "src/test/seed-sessions.ts"\nspawn("tsx", [script])\n`,
  ],
  ["src/seed.ts", `import { createApp } from "./app.js"\n`],
  [
    "src/app.ts",
    `import { seedSessionsReach } from "./sessions/seed-sessions-reach.js"\n`,
  ],
]

describe("only test files import the seeding module", () => {
  it.each(MISTAKES)("fires on %s", (file, source) => {
    expect(detect(source, file)).toEqual([
      expect.stringContaining(`${file} imports `),
    ])
  })

  it.each(CLEAN)("stays quiet on %s", (file, source) => {
    expect(detect(source, file)).toEqual([])
  })

  it("holds for every file of the api package", () => {
    const files = readdirSync(join(apiRoot, "src"), { recursive: true })
      .map(String)
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    expect(files.length).toBeGreaterThan(200)
    const problems = files.flatMap((file) =>
      detect(readFileSync(join(apiRoot, "src", file), "utf8"), `src/${file}`)
    )
    expect(problems).toEqual([])
  })
})
