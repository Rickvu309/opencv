import assert from "node:assert/strict"
import { test } from "node:test"
import { plan } from "./check.mjs"

test("docs still run affected tasks and unconditional guards", () => {
  const commands = plan({ files: ["docs/coach.md"] })
  assert.deepEqual(commands[0], [
    "exec",
    "turbo",
    "run",
    "lint",
    "typecheck",
    "test",
    "--affected",
  ])
  assert.ok(commands.some((c) => c.includes("--filter=@workspace/guards")))
  assert.ok(!commands.some((c) => c.includes("test:open-pr")))
})
test("untracked package files include dependents", () => {
  assert.ok(
    plan({ files: ["apps/web/new.ts"] }).some((c) =>
      c.includes("--filter=...{./apps/web}")
    )
  )
})
test("global changes and missing base full mode cover all packages and build", () => {
  for (const file of [
    "package.json",
    "scripts/check.mjs",
    ".gitattributes",
    ".railway/railway.ts",
    "tsconfig.json",
    "eslint.config.mjs",
  ]) {
    const commands = plan({ files: [file] })
    assert.ok(!commands[0].includes("--affected"), file)
    assert.ok(commands[0].includes("build"))
    assert.ok(commands[0].includes("test:open-pr"))
    assert.ok(!commands[0].includes("--affected"))
  }
  assert.ok(plan({ files: [], full: true })[0].includes("--force"))
})
test("open-pr inputs schedule its separate guard task", () => {
  for (const file of [
    "scripts/open-pr.sh",
    "scripts/open-pr.test.mjs",
    "scripts/lib/result.sh",
  ])
    assert.ok(plan({ files: [file] }).some((c) => c.includes("test:open-pr")))
})
test("verification skills schedule web assumptions", () => {
  assert.ok(
    plan({ files: [".claude/skills/verify-app-ui/SKILL.md"] }).some(
      (c) => c.join(" ") === "--filter web test"
    )
  )
})

import { execFileSync, spawnSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

test("dry-run executes nothing; first red stays red and writes the consumer result", () => {
  const dir = mkdtempSync(join(homedir(), "tmp/check-node-"))
  try {
    mkdirSync(join(dir, "scripts"))
    mkdirSync(join(dir, "bin"))
    copyFileSync(resolve("scripts/check.mjs"), join(dir, "scripts/check.mjs"))
    writeFileSync(join(dir, "package.json"), "{}")
    const git = (...args) =>
      execFileSync("git", args, { cwd: dir, stdio: "pipe" })
    git("init", "-q")
    git("add", ".")
    git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture")
    writeFileSync(
      join(dir, "bin/pnpm"),
      '#!/bin/sh\necho call >> "$CALLS"\nprintf "web:test: FAIL |shared-modules| src/a.test.ts\\nError: Hook timed out in 1000ms\\n"\nexit 1\n',
      { mode: 0o755 }
    )
    mkdirSync(join(dir, "apps/web"), { recursive: true })
    writeFileSync(join(dir, "apps/web/package.json"), '{"name":"web"}')
    const env = {
      ...process.env,
      PATH: `${dir}/bin:${process.env.PATH}`,
      CALLS: join(dir, "calls"),
      PR_RESULT_DIR: join(dir, "results"),
      PR_RESULT_REPO: "opencv",
      PR_RESULT_ID: "77",
      CHECK_BASE_REF: "HEAD",
      CHECK_RETRY_FAILED_TESTS: "1",
    }
    let r = spawnSync(process.execPath, ["scripts/check.mjs"], {
      cwd: dir,
      env: { ...env, CHECK_DRY_RUN: "1" },
      encoding: "utf8",
    })
    assert.equal(r.status, 0, r.stderr)
    assert.match(
      r.stdout,
      /\[dry-run\] pnpm exec turbo run lint typecheck test --affected/
    )
    assert.equal(
      JSON.parse(readFileSync(join(dir, "results/opencv-check-77.json")))
        .status,
      "ok"
    )
    r = spawnSync(process.execPath, ["scripts/check.mjs"], {
      cwd: dir,
      env: { ...env, CHECK_DRY_RUN: "0" },
      encoding: "utf8",
    })
    assert.equal(r.status, 1, r.stderr)
    assert.equal(readFileSync(join(dir, "calls"), "utf8"), "call\n")
    const result = JSON.parse(
      readFileSync(join(dir, "results/opencv-check-77.json"))
    )
    assert.equal(result.status, "fail")
    assert.equal(result.cause, "timing-test")
    assert.deepEqual(result.files, ["apps/web/src/a.test.ts"])
    assert.deepEqual(result.retried, [])
    assert.match(r.stdout.trim().split("\n").at(-1), /^RESULT_JSON:/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
