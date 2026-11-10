import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runCli } from "../cli.mjs"
import { ctxFor, fakePorts } from "../ports/fake.mjs"

const TRAILER = `${["Co", "Authored", "By"].join("-")}: Someone <a@b.c>`
const PRETTIER = "/repo/node_modules/.bin/prettier"
const ZERO = "0".repeat(40)

function world(over = {}) {
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
            ].map((dir) => [`/repo/${dir}/node_modules/.bin/tsc`, ""])
          )),
    },
    env: s.env ?? {},
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
      if (cmd !== "git") throw new Error(`unscripted ${cmd}`)
      const line = args.join(" ")
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

function commitMsg(over, text) {
  const w = world({ ...over, message: text })
  return w.call(["commit-msg", "/repo/MSG"])
}

test("commit-msg refuses main, an empty message and an attribution trailer", () => {
  const onMain = commitMsg({ branch: "main" }, "feat: x\n")
  assert.equal(onMain.code, 2)
  assert.match(onMain.text, /REFUSED ON_MAIN/)
  assert.match(onMain.text, /Fix: scripts\/ocv-tools\.mjs take <issue#>/)
  const empty = commitMsg({}, "# only a comment\n\n   \n")
  assert.equal(empty.code, 2)
  assert.match(empty.text, /REFUSED EMPTY_MESSAGE/)
  const trailer = commitMsg({}, `feat: x\n\n${TRAILER}\n`)
  assert.equal(trailer.code, 2)
  assert.match(trailer.text, /REFUSED NO_AI_ATTRIBUTION/)
  const commented = commitMsg({}, `feat: x\n# ${TRAILER}\n`)
  assert.equal(commented.code, 0, commented.text)
})

test("commit-msg passes a clean message and only warns about a long first line", () => {
  const clean = commitMsg({}, "feat: x\n\nbody\n")
  assert.equal(clean.code, 0)
  assert.equal(clean.text, "")
  const long = commitMsg({}, `feat: ${"x".repeat(80)}\n`)
  assert.equal(long.code, 0)
  assert.match(long.text, /warning: first line is 86 characters/)
})

test("pre-commit formats a fully staged file and stages the result", () => {
  const w = world({ staged: ["a.mjs", "b.mjs"] })
  const r = w.call(["pre-commit"])
  assert.equal(r.code, 0, r.text)
  const write = w.s.calls.find((c) => c.args?.includes("--write"))
  assert.deepEqual(write.args.slice(-3), ["--", "a.mjs", "b.mjs"])
  assert.deepEqual(w.git("add")[0].args, ["add", "--", "a.mjs", "b.mjs"])
})

test("pre-commit refuses a partly staged file prettier would change", () => {
  const w = world({
    staged: ["a.mjs", "b.mjs"],
    unstaged: ["a.mjs"],
    dirty: ["a.mjs"],
  })
  const r = w.call(["pre-commit"])
  assert.equal(r.code, 2)
  assert.match(r.text, /pnpm exec prettier --write 'a\.mjs'/)
  assert.doesNotMatch(r.text, /b\.mjs'/)
  const clean = world({ staged: ["a.mjs"], unstaged: ["a.mjs"] })
  assert.equal(clean.call(["pre-commit"]).code, 0)
  assert.equal(clean.git("add").length, 0)
})

test("pre-commit only checks under a temporary index", () => {
  const w = world({
    staged: ["a.mjs"],
    dirty: ["a.mjs"],
    env: { GIT_INDEX_FILE: "/repo/.git/next-index-1" },
  })
  const r = w.call(["pre-commit"])
  assert.equal(r.code, 2)
  assert.match(r.text, /git commit <path>/)
  assert.equal(w.git("add").length, 0)
  const real = world({
    staged: ["a.mjs"],
    env: { GIT_INDEX_FILE: "/repo/.git/index.lock" },
  })
  assert.equal(real.call(["pre-commit"]).code, 0)
  assert.equal(real.git("add").length, 1)
})

test("pre-commit warns and skips formatting when prettier is missing", () => {
  const w = world({ staged: ["a.mjs"], noPrettier: true })
  const r = w.call(["pre-commit"])
  assert.equal(r.code, 0)
  assert.match(r.text, /prettier is missing/)
  assert.equal(w.git("add").length, 0)
})

test("pre-commit refuses an oversize staged file and skips generated, binary and submodule blobs", () => {
  const big = "x".repeat(20001)
  const w = world({
    staged: ["big.mjs", "lock.json", "image.png", "sub", "ok.mjs"],
    blobs: {
      "big.mjs": { content: big },
      "lock.json": { content: big },
      "image.png": { content: `\0${big}` },
      sub: { content: big, mode: "160000" },
      "ok.mjs": { content: "x" },
    },
    generated: ["lock.json"],
  })
  const r = w.call(["pre-commit"])
  assert.equal(r.code, 2)
  assert.match(r.text, /REFUSED FILE_SIZE: .*big\.mjs \(20001 bytes\)/)
  assert.doesNotMatch(r.text, /lock\.json|image\.png|sub|ok\.mjs/)
  assert.match(r.text, /Split each file by responsibility/)
  const exact = world({
    staged: ["edge.mjs"],
    blobs: { "edge.mjs": { content: "x".repeat(20000) } },
  })
  assert.equal(exact.call(["pre-commit"]).code, 0)
})

test("pre-commit refuses to commit on main", () => {
  const r = world({ branch: "main", staged: ["a.mjs"] }).call(["pre-commit"])
  assert.equal(r.code, 2)
  assert.match(r.text, /REFUSED ON_MAIN/)
})

const push = (...refs) =>
  refs.map(([ref, sha]) => `${ref} ${sha ?? "abc"} ${ref} ${ZERO}`).join("\n")

test("pre-push refuses main and bad branch names, allows bot and delete pushes", () => {
  const w = world()
  const main = w.call(["pre-push", "origin", "url"], {
    stdin: push(["refs/heads/main"]),
  })
  assert.equal(main.code, 2)
  assert.match(main.text, /REFUSED NO_PUSH_MAIN/)
  const gone = w.call(["pre-push"], { stdin: push(["refs/heads/main", ZERO]) })
  assert.match(gone.text, /NO_PUSH_MAIN: deleting main/)
  const bad = w.call(["pre-push"], { stdin: push(["refs/heads/bad-name"]) })
  assert.equal(bad.code, 2)
  assert.match(bad.text, /REFUSED BRANCH_NAME: branch 'bad-name'/)
  assert.equal(w.s.calls.filter((c) => c.cmd === "pnpm").length, 0)
  for (const stdin of [
    push(["refs/heads/dependabot/npm/x"]),
    push(["refs/heads/renovate/y"]),
    push(["refs/heads/bad-name", ZERO]),
    push(["refs/tags/v1.0.0"]),
    "",
  ])
    assert.equal(w.call(["pre-push"], { stdin }).code, 0, stdin)
})

const nodeCalls = (w) =>
  w.s.calls.filter((c) => c.cmd === "node" || c.cmd === "env")
const pushOk = push(["refs/heads/feat/1-x"])

test("pre-push runs only the quick checks and never the full suite", () => {
  const w = world({
    changed: ["apps/web/src/a.tsx", "packages/ui/src/b.ts", "README.md"],
  })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /quick checks passed in \d+s/)
  const commands = w.s.calls
    .filter((c) => c.cmd !== "git")
    .map((c) => [c.cmd.split("/").pop(), ...c.args].join(" "))
  assert.deepEqual(
    commands.map((line) => line.split(" ")[0]),
    ["prettier", "eslint", "eslint", "tsc", "tsc", "tsc", "node"]
  )
  assert.deepEqual(
    w.s.calls
      .filter((c) => c.cmd.endsWith("/tsc"))
      .map((c) => [c.options.cwd, c.args[1]]),
    [
      ["/repo/apps/web", "tsconfig.app.json"],
      ["/repo/apps/web", "tsconfig.node.json"],
      ["/repo/packages/ui", "tsconfig.json"],
    ]
  )
  assert.equal(w.s.calls.filter((c) => c.cmd === "pnpm").length, 0)
  assert.equal(
    commands.filter((line) => /turbo|vitest|vite/.test(line)).length,
    0,
    commands.join("\n")
  )
  const prettier = w.s.calls.find((c) => c.cmd === PRETTIER)
  assert.deepEqual(prettier.args.slice(-3), [
    "apps/web/src/a.tsx",
    "packages/ui/src/b.ts",
    "README.md",
  ])
  const web = w.s.calls.find(
    (c) => c.cmd === "/repo/apps/web/node_modules/.bin/eslint"
  )
  assert.deepEqual(web.args.slice(-1), ["src/a.tsx"])
  assert.equal(web.options.cwd, "/repo/apps/web")
  const [comments] = nodeCalls(w)
  assert.deepEqual(comments.args, ["scripts/no-comments.mjs"])
  assert.equal(nodeCalls(w).length, 1)
  assert.ok(!commands.some((line) => line.includes("--test")))
})

test("pre-push still refuses a comment, bad formatting, a lint error and a failing guard", () => {
  const refused = (failing) => {
    const w = world({ changed: ["apps/web/src/a.tsx"], failing })
    return w.call(["pre-push"], { stdin: pushOk })
  }
  const comment = refused(["no-comments"])
  assert.equal(comment.code, 2)
  assert.match(
    comment.text,
    /REFUSED QUICK_CHECKS: the quick checks failed: no-comments/
  )
  assert.match(refused(["prettier"]).text, /failed: prettier/)
  assert.match(refused(["eslint"]).text, /failed: eslint apps\/web/)
  const typed = refused(["tsc"])
  assert.equal(typed.code, 2)
  assert.match(typed.text, /failed: typecheck apps\/web/)
  assert.equal(refused(["rules-doc"]).code, 0)
  const everything = refused(["no-comments", "eslint"])
  assert.match(everything.text, /eslint apps\/web, no-comments/)
})

test("pre-push typechecks after a deleted file and for a package file change", () => {
  const dirs = (over) => {
    const w = world(over)
    const r = w.call(["pre-push"], { stdin: pushOk })
    assert.equal(r.code, 0, r.text)
    return w.s.calls
      .filter((c) => c.cmd.endsWith("/tsc"))
      .map((c) => c.options.cwd)
  }
  assert.deepEqual(dirs({ deleted: ["packages/ui/src/gone.tsx"] }), [
    "/repo/apps/web",
    "/repo/apps/web",
    "/repo/packages/ui",
  ])
  assert.deepEqual(dirs({ changed: ["apps/api/package.json"] }), [
    "/repo/apps/api",
  ])
  const deleting = world({ deleted: ["packages/ui/src/gone.tsx"] })
  deleting.call(["pre-push"], { stdin: pushOk })
  assert.equal(
    deleting.s.calls.filter((c) => c.cmd.endsWith("/eslint")).length,
    0
  )
})

test("pre-push names the missing install when the TypeScript tools are absent", () => {
  const w = world({ changed: ["apps/web/src/a.tsx"], noTsc: true })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /failed: typecheck apps\/web \(the TypeScript tools are not installed here; run pnpm install in this worktree\)/
  )
  assert.equal(w.s.calls.filter((c) => c.cmd.endsWith("/tsc")).length, 0)
})

test("pre-push refuses a bad branch name before it runs any check", () => {
  const w = world({ changed: ["apps/web/src/a.tsx"] })
  const r = w.call(["pre-push"], { stdin: push(["refs/heads/bad-name"]) })
  assert.equal(r.code, 2)
  assert.match(r.text, /REFUSED BRANCH_NAME/)
  assert.equal(w.s.calls.filter((c) => c.cmd !== "git").length, 0)
})

test("pre-push does not run the guard suite when scripts/ocv-tools changed", () => {
  const tools = world({
    changed: ["scripts/ocv-tools/jobs/hook.mjs"],
    toolTests: ["scripts/ocv-tools/jobs/hook.test.mjs"],
  })
  const r = tools.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.ok(!nodeCalls(tools).some((call) => call.args.includes("--test")))
  assert.equal(tools.git("ls-files").length, 0)
})

test("pre-push without origin/main skips prettier and eslint but still checks comments", () => {
  const w = world({ noBase: true })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /origin\/main is missing/)
  assert.equal(nodeCalls(w).length, 1)
  assert.equal(w.s.calls.filter((c) => c.cmd.endsWith("prettier")).length, 0)
})

test("pre-push on a delete runs no check", () => {
  const deleting = world()
  deleting.call(["pre-push"], { stdin: push(["refs/heads/feat/1-x", ZERO]) })
  assert.equal(deleting.s.calls.filter((c) => c.cmd !== "git").length, 0)
})

test("pre-push with SKIP_CHECKS=1 warns, skips the check, and needs a named human", () => {
  const declared = world({
    env: { SKIP_CHECKS: "1", SKIP_CHECKS_DECLARED_BY: "Ada" },
  })
  const r = declared.call(["pre-push"], {
    stdin: push(["refs/heads/feat/1-x"]),
  })
  assert.equal(r.code, 0)
  assert.match(r.text, /WARNING: SKIP_CHECKS=1/)
  assert.equal(declared.s.calls.filter((c) => c.cmd !== "git").length, 0)
  const nobody = world({ env: { SKIP_CHECKS: "1" } })
  const refused = nobody.call(["pre-push"], {
    stdin: push(["refs/heads/feat/1-x"]),
  })
  assert.equal(refused.code, 2)
  assert.match(refused.text, /REFUSED SKIP_DECLARED/)
})

test("hook rejects unknown names, flags and the missing message file", () => {
  const w = world()
  assert.match(w.call(["nope"]).text, /UNKNOWN_COMMAND/)
  assert.match(w.call(["pre-push", "--no-verify"]).text, /UNKNOWN_FLAG/)
  assert.equal(w.call(["commit-msg"]).code, 1)
  assert.equal(w.call([]).code, 1)
})

test("the hook job imports only node: builtins and scripts/ocv-tools", () => {
  const src = readFileSync(new URL("./hook.mjs", import.meta.url), "utf8")
  const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])
  assert.ok(imports.length > 0)
  for (const from of imports)
    assert.ok(
      from.startsWith("node:") ||
        from.startsWith("../") ||
        from.startsWith("./"),
      from
    )
  for (const from of imports.filter((f) => f.startsWith("../")))
    assert.ok(!from.startsWith("../../"), from)
})

test("each git hook is a shim over the hook verb", () => {
  for (const name of ["commit-msg", "pre-commit", "pre-push"]) {
    const text = readFileSync(
      new URL(`../../../.githooks/${name}`, import.meta.url),
      "utf8"
    )
    assert.ok(text.split("\n").length <= 8, name)
    assert.match(text, /^#!\/usr\/bin\/env bash\n/)
    assert.match(
      text,
      new RegExp(
        `exec node "\\$\\(git rev-parse --show-toplevel\\)/scripts/ocv-tools\\.mjs" hook ${name} "\\$@"`
      )
    )
    assert.match(text, /command -v node/)
  }
})
