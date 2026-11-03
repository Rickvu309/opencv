#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process"
import {
  appendFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" })
  if (r.status !== 0) throw new Error(r.stderr || "git failed")
  return r.stdout.trimEnd()
}
export function plan({ files, full = false }) {
  const force = full
  full ||= files.some(
    (f) =>
      /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.npmrc|\.nvmrc|\.node-version|\.pnpmfile\.cjs|vitest\.[^/]*|scripts\/check\.(sh|mjs)|\.railway\/railway\.ts|\.gitattributes)$/.test(
        f
      ) ||
      (!f.includes("/") &&
        /(^tsconfig.*\.json$|\.config\.|^\.eslint|^\.prettier)/.test(f))
  )
  const tasks = ["lint", "typecheck", "test"]
  if (full) tasks.push("test:open-pr", "build")
  const commands = [
    [
      "exec",
      "turbo",
      "run",
      ...tasks,
      ...(full ? (force ? ["--force"] : []) : ["--affected"]),
    ],
  ]
  const untrackedSafeFilterDirs = [
    ...new Set(
      files
        .filter((f) => /^(apps|packages)\/[^/]+\//.test(f))
        .map((f) => f.split("/").slice(0, 2).join("/"))
    ),
  ]
  if (!full && untrackedSafeFilterDirs.length)
    commands.push([
      "exec",
      "turbo",
      "run",
      ...tasks,
      ...untrackedSafeFilterDirs.map((d) => `--filter=...{./${d}}`),
    ])
  if (!full) {
    commands.push([
      "exec",
      "turbo",
      "run",
      "test",
      ...(files.some((f) => /^scripts\/(open-pr\.(sh|test\.mjs)|lib\/)/.test(f))
        ? ["test:open-pr"]
        : []),
      "--filter=@workspace/guards",
    ])
    if (
      files.some((f) =>
        /^\.claude\/skills\/(verify-app-ui|verify-landing)\//.test(f)
      )
    )
      commands.push(["--filter", "web", "test"])
  }
  commands.push([
    "exec",
    "prettier",
    "--check",
    "--ignore-unknown",
    "--",
    ...(full ? ["."] : files.filter((f) => existsSync(f))),
  ])
  return commands.filter((c) => c[1] !== "prettier" || c.length > 5)
}

async function main() {
  const start = new Date()
  let transcript = ""
  const slug = (s) => s.replace(/[^A-Za-z0-9._#-]/g, "-")
  const common = git("rev-parse", "--path-format=absolute", "--git-common-dir")
  const repo = process.env.PR_RESULT_REPO || basename(dirname(common))
  const id = slug(
    process.env.PR_RESULT_ID || git("rev-parse", "--abbrev-ref", "HEAD")
  )
  const dir = process.env.PR_RESULT_DIR || join(homedir(), "tmp/pr-results")
  mkdirSync(join(dir, "logs"), { recursive: true })
  const log = join(dir, "logs", `check-${process.pid}.log`)
  writeFileSync(log, "")
  let failed = null
  let full = process.argv.includes("--full")
  let base
  let files = []
  try {
    base = git(
      "merge-base",
      process.env.CHECK_BASE_REF || "origin/main",
      "HEAD"
    )
  } catch {
    full = true
  }
  if (base)
    files = [
      ...new Set(
        [
          ...git("diff", "--name-only", "--no-renames", "-z", base).split("\0"),
          ...git("ls-files", "--others", "--exclude-standard", "-z").split(
            "\0"
          ),
        ].filter(Boolean)
      ),
    ]
  const env = {
    ...process.env,
    TURBO_SCM_BASE: base,
    VITEST_MAX_WORKERS: process.env.VITEST_MAX_WORKERS || "2",
  }
  for (const args of plan({ files, full })) {
    if (args[1] === "turbo")
      args.push(
        `--concurrency=${process.env.CHECK_CONCURRENCY || 2}`,
        "--no-daemon"
      )
    console.log(
      `${process.env.CHECK_DRY_RUN === "1" ? "[dry-run] " : ""}pnpm ${args.join(" ")}`
    )
    if (process.env.CHECK_DRY_RUN === "1") continue
    const status = await new Promise((resolve) => {
      const child = spawn("pnpm", args, {
        env,
        stdio: ["inherit", "pipe", "pipe"],
      })
      const record = (chunk) => {
        const output = chunk.toString()
        transcript += output
        process.stdout.write(output)
        appendFileSync(log, output)
      }
      child.stdout.on("data", record)
      child.stderr.on("data", record)
      child.on("error", (error) => {
        record(String(error))
        resolve(1)
      })
      child.on("close", (code) => resolve(code ?? 1))
    })
    if (status !== 0) {
      failed = args
      break
    }
  }
  const clean = transcript.replace(/\x1b\[[0-9;]*m/g, "")
  const failingFiles = []
  for (const line of clean.split("\n")) {
    const match = line.match(
      /FAIL\s+(?:\|[^|]+\|\s+)?([^\s]+\.(?:test|spec)\.[a-z]+)/
    )
    if (!match) continue
    const pkg = line.match(/^([^: ]+):[a-z:-]+\s/)?.[1]
    let prefix = ""
    for (const group of ["apps", "packages"]) {
      if (!existsSync(group)) continue
      for (const d of readdirSync(group)) {
        const manifest = `${group}/${d}/package.json`
        if (
          existsSync(manifest) &&
          JSON.parse(readFileSync(manifest, "utf8")).name === pkg
        )
          prefix = `${group}/${d}/`
      }
    }
    failingFiles.push(prefix + match[1])
  }
  let cause = "none"
  if (failed) {
    cause =
      failed.includes("prettier") || /Failed:.*#lint\b/.test(clean)
        ? "lint"
        : /Failed:.*#typecheck\b/.test(clean)
          ? "typecheck"
          : /Failed:.*#build\b/.test(clean)
            ? "build"
            : "test"
    if (
      cause === "test" &&
      /^([A-Za-z0-9@/_.-]+:test: )? *Error: (Hook|Test) timed out in [0-9]+ ?ms/m.test(
        clean
      )
    )
      cause = "timing-test"
  }
  const output = {
    schema: 1,
    script: "check",
    repo,
    id,
    status: failed ? "fail" : "ok",
    cause,
    detail: failed ? `failed: pnpm ${failed.join(" ")}` : null,
    files: [...new Set(failingFiles)],
    blockedBy: null,
    retried: [],
    next: failed ? "pnpm check" : null,
    log,
    startedAt: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    durSec: Math.floor((Date.now() - start.getTime()) / 1000),
  }
  const file = join(dir, `${repo}-check-${id}.json`)
  writeFileSync(`${file}.${process.pid}`, JSON.stringify(output) + "\n")
  renameSync(`${file}.${process.pid}`, file)
  appendFileSync(join(dir, "history.jsonl"), JSON.stringify(output) + "\n")
  console.log(`RESULT_JSON: ${file}`)
  process.exitCode = failed ? 1 : 0
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main()
