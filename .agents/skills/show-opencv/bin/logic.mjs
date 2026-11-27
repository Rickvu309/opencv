import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { toMarkdown } from "../logic/page.mjs"
import { readTree } from "../logic/tree.mjs"

const usage =
  "node .agents/skills/show-opencv/bin/logic.mjs tree.json [--out dir]"

export function resolverFor(repo) {
  return (ref) => {
    if (/^https:\/\/\S+$/.test(ref)) return Boolean(URL.canParse(ref))
    const [, file, line] =
      ref.replace(/#.*$/, "").match(/^(.+?)(?::(\d+))?$/) ?? []
    if (!file) return false
    const full = path.resolve(repo, file.replace(/^~(?=\/)/, homedir()))
    const stat = statSync(full, { throwIfNoEntry: false })
    if (!stat?.isFile()) return false
    if (line === undefined) return true
    const lines = readFileSync(full, "utf8")
      .replace(/\r?\n$/, "")
      .split(/\r?\n/)
    return Number(line) >= 1 && Number(line) <= lines.length
  }
}

function main(args) {
  const [input, flag, out] = args
  if (
    !input ||
    (args.length !== 1 && (args.length !== 3 || flag !== "--out" || !out))
  )
    throw new Error(usage)
  const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim()
  const { tree, refusals } = readTree(JSON.parse(readFileSync(input, "utf8")), {
    resolves: resolverFor(repo),
  })
  if (!tree) {
    console.log(JSON.stringify({ refusals }, null, 2))
    return 1
  }
  const directory = path.resolve(out ?? path.dirname(input))
  mkdirSync(directory, { recursive: true })
  const file = path.join(directory, "tree.md")
  writeFileSync(file, toMarkdown(tree))
  console.log(JSON.stringify({ verdict: tree.verdict, file }))
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
