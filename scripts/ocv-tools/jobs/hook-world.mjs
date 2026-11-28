import { runCli } from "../cli.mjs"
import { ctxFor, fakePorts } from "../ports/fake.mjs"

export const TRAILER = `${["Co", "Authored", "By"].join("-")}: Someone <a@b.c>`
export const PRETTIER = "/repo/node_modules/.bin/prettier"
export const ZERO = "0".repeat(40)
const OLD_ID = "1".repeat(40)
const NEW_ID = "2".repeat(40)
const RAW_CHANGED = `:100644 100644 ${OLD_ID} ${NEW_ID} M`
const RAW_DELETED = `:100644 000000 ${OLD_ID} ${ZERO} D`

export function world(over = {}) {
  const s = {
    branch: "feat/1-x",
    staged: [],
    unstaged: [],
    blobs: {},
    generated: [],
    dirty: [],
    pnpmOk: true,
    changed: [],
    failing: [],
    noBase: false,
    gitFails: [],
    calls: [],
    ...over,
  }
  const ok = (out = "") => ({ ok: true, out, err: "" })
  const blobOf = (path) => s.blobs[path] ?? { content: "x\n" }
  const bySha = (sha) => blobOf(sha.replace("sha-", ""))
  const ports = fakePorts({
    cwd: "/repo",
    files: {
      "/repo/MSG": s.message ?? "",
      ...(s.noPrettier ? {} : { [PRETTIER]: "" }),
      ...(s.noTsc
        ? {}
        : Object.fromEntries(
            ["apps/api", "apps/web", "packages/domain", "packages/ui"].flatMap(
              (dir) => [
                [`/repo/${dir}/node_modules/.bin/tsc`, ""],
                [`/repo/${dir}/node_modules/.bin/vitest`, ""],
              ]
            )
          )),
    },
    env: s.env ?? {},
    run(cmd, args, options = {}) {
      s.calls.push({ cmd, args, options })
      if (cmd === "pnpm")
        return s.pnpmOk ? ok() : { ok: false, out: "", err: "" }
      if (cmd === "node" && String(args[0]).endsWith("catalog-judge.mjs"))
        return ok(JSON.stringify(s.catalog ?? { stale: [] }))
      if (
        cmd === "node" ||
        cmd.endsWith("/vitest") ||
        cmd.endsWith("/eslint") ||
        cmd.endsWith("/tsc") ||
        args.includes("--check")
      ) {
        const label =
          cmd === "node" || cmd.endsWith("/vitest")
            ? args[args.length - 1]
            : cmd.split("/").pop()
        const hit = s.failing.some((name) => label.includes(name))
        return hit ? { ok: false, out: "", err: "" } : ok()
      }
      if (cmd === PRETTIER) {
        if (args.includes("--write")) return ok()
        const path = args[args.indexOf("--stdin-filepath") + 1]
        return ok(s.dirty.includes(path) ? `${options.input}\n` : options.input)
      }
      if (cmd.endsWith("/vitest")) {
        const hit = s.failing.some((name) => args.join(" ").includes(name))
        return hit ? { ok: false, out: "", err: "" } : ok()
      }
      if (cmd !== "git") throw new Error(`unscripted ${cmd}`)
      const line = args.join(" ")
      if ((s.gitFails ?? []).some((prefix) => line.startsWith(prefix)))
        return { ok: false, out: "", err: `fatal: ${line} broke` }
      if (line === "rev-parse HEAD") return ok(s.head ?? "abc")
      if (line === "rev-parse HEAD^{tree}") return ok(s.tree ?? "tree1")
      if (
        args[0] === "rev-parse" &&
        args.length === 2 &&
        args[1].endsWith("^{tree}")
      )
        return ok(`tree-${args[1].slice(0, -7)}`)
      if (line.startsWith("diff --raw -z --no-renames --no-abbrev")) {
        if (s.rawDiff !== undefined) return ok(s.rawDiff)
        return ok(
          [
            ...s.changed.map((path) => `${RAW_CHANGED}\0${path}\0`),
            ...(s.deleted ?? []).map((path) => `${RAW_DELETED}\0${path}\0`),
          ].join("")
        )
      }
      if (args[0] === "rev-parse" && args.length === 3)
        return ok(
          (s.sameTree ?? (!s.changed.length && !(s.deleted ?? []).length))
            ? "t0\nt0"
            : "t0\nt1"
        )
      if (line.startsWith("status --porcelain"))
        return ok(s.worktreeDirty ?? "")
      if (line.startsWith("merge-base"))
        return s.noBase ? { ok: false, out: "", err: "" } : ok("base1")
      if (line.includes("--diff-filter=ACMR -z base1 HEAD"))
        return ok(s.changed.join("\0"))
      if (line.includes("--diff-filter=ACMRD -z base1 HEAD"))
        return ok([...s.changed, ...(s.deleted ?? [])].join("\0"))
      if (args[0] === "ls-files" && args.includes("--others"))
        return ok((s.untracked ?? []).join("\0"))
      if (args[0] === "ls-files" && args[2] === "--")
        return ok("package.json\0")
      if (args[0] === "checkout-index") return ok("")
      if (line.startsWith("rev-parse --show-toplevel")) return ok("/repo")
      if (line.startsWith("rev-parse --absolute-git-dir"))
        return ok("/repo/.git")
      if (line.startsWith("symbolic-ref")) return ok(s.branch)
      if (line.startsWith("diff --name-only")) return ok(s.unstaged.join("\0"))
      if (line.startsWith("diff --cached --name-only"))
        return ok(s.staged.join("\0"))
      if (line.startsWith("diff --cached --no-renames --raw"))
        return ok(
          s.staged
            .map(
              (p) => `:100644 ${blobOf(p).mode ?? "100644"} a sha-${p} M\0${p}`
            )
            .join("\0")
        )
      if (args[0] === "cat-file" && args[1] === "-s")
        return ok(String(bySha(args[2]).size ?? bySha(args[2]).content.length))
      if (args[0] === "cat-file" && args[1] === "blob")
        return ok(bySha(args[2]).content)
      if (args[0] === "check-attr")
        return ok(
          options.input
            .split("\0")
            .filter(Boolean)
            .map(
              (p) =>
                `${p}\0linguist-generated\0${s.generated.includes(p) ? "set" : "unspecified"}\0`
            )
            .join("")
        )
      if (args[0] === "show") return ok(blobOf(args[1].slice(1)).content)
      if (args[0] === "add") return ok()
      throw new Error(`unscripted git ${line}`)
    },
  })
  const call = (argv, extra = {}) =>
    runCli(["hook", ...argv], ctxFor(ports, { cwd: "/repo", ...extra }))
  const git = (verb) =>
    s.calls.filter((c) => c.cmd === "git" && c.args[0] === verb)
  const cli = (argv, extra = {}) =>
    runCli(argv, ctxFor(ports, { cwd: "/repo", ...extra }))
  return { s, call, cli, git }
}

export const push = (...refs) =>
  refs.map(([ref, sha]) => `${ref} ${sha ?? "abc"} ${ref} ${ZERO}`).join("\n")

export const pushOk = push(["refs/heads/feat/1-x"])
