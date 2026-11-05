#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempDir, removeTempDir } from "./lib/temp-dir.mjs"
import {
  expectedMutantExit,
  mutantOf,
  ownConfigs,
  specName,
} from "./lib/tla-specs.mjs"

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

export const STATUS = Object.freeze({
  0: "ok",
  10: "assumption violated",
  11: "deadlock",
  12: "invariant violated",
  13: "liveness violated",
})
export const NO_TOOLCHAIN = 2
export const TLC_TIMEOUT_MS = 10 * 60 * 1000

export const statusOf = (code) => STATUS[code] ?? "error"

export function resolveJava({
  env = process.env,
  home = homedir(),
  exists = existsSync,
} = {}) {
  const base = env.JAVA_HOME || join(home, ".local", "jdk")
  const java = join(base, "bin", "java")
  return exists(java) ? java : null
}

export function resolveJar({
  env = process.env,
  home = homedir(),
  exists = existsSync,
} = {}) {
  const jar = env.TLA2TOOLS || join(home, ".local", "tla", "tla2tools.jar")
  return exists(jar) ? jar : null
}

export function tlcArgs({ jar, cfg, spec, metadir, dump }) {
  return [
    "-XX:+UseParallelGC",
    `-Djava.io.tmpdir=${metadir}`,
    "-cp",
    jar,
    "tlc2.TLC",
    "-workers",
    "1",
    "-metadir",
    metadir,
    ...(dump ? ["-dump", dump] : []),
    "-config",
    cfg,
    spec,
  ]
}

export function outputOf(result) {
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`
  return result.error ? `${text}tlc: ${result.error.message}\n` : text
}

export function outFileName(tla, cfg) {
  const folder = posix.dirname(tla).replaceAll("/", "__")
  return `${folder}__${posix.basename(cfg, ".cfg")}.out`
}

export function runTlc({
  spec,
  cfg,
  out,
  dump,
  toolchain = {},
  timeout = TLC_TIMEOUT_MS,
}) {
  const java = resolveJava(toolchain)
  const jar = resolveJar(toolchain)
  if (!java || !jar)
    return { code: NO_TOOLCHAIN, status: "no toolchain", output: "" }
  const specPath = resolve(spec)
  const metadir = makeTempDir("tlc-")
  try {
    const result = spawnSync(
      java,
      tlcArgs({
        jar,
        cfg: resolve(cfg),
        spec: specPath,
        metadir,
        dump: dump && resolve(dump),
      }),
      {
        cwd: dirname(specPath),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout,
      }
    )
    const output = outputOf(result)
    if (out) {
      mkdirSync(dirname(resolve(out)), { recursive: true })
      writeFileSync(out, output)
    }
    const code = result.status ?? 1
    return { code, status: statusOf(code), output }
  } finally {
    removeTempDir(metadir)
  }
}

function listSpecFiles() {
  return execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "*.tla",
      "*.tla.json",
      "*.cfg",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
}

export function allRuns(
  files = listSpecFiles(),
  read = (path) => readFileSync(join(root, path), "utf8")
) {
  const runs = []
  for (const tla of files.filter((file) => file.endsWith(".tla")).sort()) {
    const mapPath = tla.replace(/\.tla$/, ".tla.json")
    const mapText = files.includes(mapPath) ? read(mapPath) : undefined
    for (const cfg of ownConfigs(tla, files)) {
      runs.push({ tla, cfg, expect: 0 })
      runs.push({
        tla,
        cfg: mutantOf(cfg),
        expect: expectedMutantExit(mapText, tla, cfg),
      })
    }
  }
  return runs
}

function parse(argv) {
  const options = { positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--all") options.all = true
    else if (arg === "--mutant") options.mutant = true
    else if (arg === "--config") options.config = argv[++i]
    else if (arg === "--out") options.out = argv[++i]
    else if (arg === "--out-dir") options.outDir = argv[++i]
    else if (arg === "--dump") options.dump = argv[++i]
    else options.positional.push(arg)
  }
  return options
}

const tail = (text, lines) => text.split("\n").slice(-lines).join("\n")

function noToolchain() {
  process.stderr.write(
    "tlc: Java or tla2tools.jar not found. Set JAVA_HOME and TLA2TOOLS, or install them under ~/.local/jdk and ~/.local/tla/tla2tools.jar.\n"
  )
  return NO_TOOLCHAIN
}

function runAll(options) {
  if (!resolveJava() || !resolveJar()) return noToolchain()
  let failed = 0
  for (const { tla, cfg, expect } of allRuns()) {
    const label = `${posix.basename(cfg)}`
    const out = options.outDir
      ? join(options.outDir, outFileName(tla, cfg))
      : undefined
    const { code, status, output } = runTlc({
      spec: join(root, tla),
      cfg: join(root, cfg),
      out,
    })
    const pass = code === expect
    if (!pass) failed += 1
    process.stdout.write(
      `${pass ? "PASS" : "FAIL"} ${tla} ${label}: exit ${code} (${status}), expected ${expect}\n`
    )
    if (!pass && status === "error")
      process.stdout.write(`${tail(output, 10)}\n`)
  }
  return failed === 0 ? 0 : 1
}

export function main(argv) {
  const options = parse(argv)
  if (options.all) return runAll(options)
  const [spec] = options.positional
  if (!spec) {
    process.stderr.write(
      "usage: node scripts/tlc.mjs <Spec.tla> [--mutant | --config <file.cfg>] [--out tlc.out] [--dump states.dump]\n       node scripts/tlc.mjs --all [--out-dir <dir>]\n"
    )
    return 64
  }
  if (!resolveJava() || !resolveJar()) return noToolchain()
  const base = resolve(spec).replace(/\.tla$/, "")
  const cfg =
    options.config ?? (options.mutant ? `${base}.mutant.cfg` : `${base}.cfg`)
  const out = options.out ?? "tlc.out"
  const { code, status, output } = runTlc({
    spec,
    cfg,
    out,
    dump: options.dump,
  })
  process.stdout.write(
    `tlc ${specName(spec)}: exit ${code} (${status}), full output in ${out}\n`
  )
  if (code !== 0) process.stdout.write(`${tail(output, 40)}\n`)
  return code
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = main(process.argv.slice(2))
