import { runCli } from "../cli.mjs"
import { ctxFor, fakePorts } from "../ports/fake.mjs"

export const TRAILER = `${["Co", "Authored", "By"].join("-")}: Someone <a@b.c>`
export const PRETTIER = "/repo/node_modules/.bin/prettier"
export const ZERO = "0".repeat(40)

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
    toolTests: [],
    failing: [],
    noBase: false,
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
            [
              "apps/api",
              "apps/web",
              "packages/domain",
              "packages/paper-crdt",
              "packages/ui",
            ].flatMap((dir) => [
              [`/repo/${dir}/node_modules/.bin/tsc`, ""],
              [`/repo/${dir}/node_modules/.bin/vitest`, ""],
            ])
          )),
    },
    env: s.env ?? {},
    affectedReceipts: s.receipt ?? false,
    run(cmd, args, options = {}) {
      s.calls.push({ cmd, args, options })
      if (cmd === "pnpm")
        return s.pnpmOk ? ok() : { ok: false, out: "", err: "" }
      if (
        cmd === "node" ||
        cmd === "env" ||
        cmd.endsWith("/eslint") ||
        cmd.endsWith("/tsc") ||
        args.includes("--check")
      ) {
        const label =
          cmd === "node" || cmd === "env"
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
      if (line === "rev-parse HEAD") return ok(s.head ?? "abc")
      if (args[0] === "ls-tree") return ok((s.tests ?? []).join("\0"))
      if (line === "cat-file --batch")
        return ok(
          (s.tests ?? [])
            .map((path) => {
              const text = s.testText?.[path] ?? ""
              return `sha-${path} blob ${Buffer.byteLength(text)}\n${text}\n`
            })
            .join("")
        )
      if (line.startsWith("status --porcelain"))
        return ok(s.worktreeDirty ?? "")
      if (line.startsWith("diff --name-only --no-renames --diff-filter=ACMRD"))
        return ok([...s.changed, ...(s.deleted ?? [])].join("\0"))
      if (line.startsWith("merge-base"))
        return s.noBase ? { ok: false, out: "", err: "" } : ok("base1")
      if (line.includes("--diff-filter=ACMR -z base1 HEAD"))
        return ok(s.changed.join("\0"))
      if (line.includes("--diff-filter=ACMRD -z base1 HEAD"))
        return ok([...s.changed, ...(s.deleted ?? [])].join("\0"))
      if (args[0] === "ls-files") return ok(s.toolTests.join("\0"))
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
  return { s, call, git }
}

export const push = (...refs) =>
  refs.map(([ref, sha]) => `${ref} ${sha ?? "abc"} ${ref} ${ZERO}`).join("\n")

export const pushOk = push(["refs/heads/feat/1-x"])
