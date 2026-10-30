import { ctxFor, fakePorts } from "../ports/fake.mjs"
import { runCli } from "../cli.mjs"

export const BODY =
  "## Summary\n\nA useful change.\n\n## Evidence\n\nBefore and after.\n\n## Merge Danger\n\n**Door:** two-way\n**Blast Radius:** jobs\n"
export function fixture(over = {}) {
  const s = {
    tree: "tree-1",
    base: "base-1",
    dirty: "",
    mainDirty: "",
    mainBranch: "main",
    checkOk: true,
    changed: [],
    commits: "feat: useful change (#90)",
    size: 100,
    issueState: "OPEN",
    issueLabels: [],
    existing: [],
    createOk: true,
    pushOk: true,
    pull: {
      number: 91,
      state: "OPEN",
      author: { login: "owner" },
      isDraft: false,
      labels: [],
      title: "feat: Keep my search (#90)",
      body: "Closes #90\n",
      headRefName: "feat/90-keep-my-search",
      headRefOid: "head-1",
      mergeCommit: null,
      closingIssuesReferences: [{ number: 90 }],
    },
    checks: [
      {
        id: 1,
        name: "ci",
        status: "completed",
        conclusion: "success",
        head_sha: "head-1",
      },
    ],
    queue: false,
    closeWorks: true,
    ...over,
  }
  const ok = (out = "") => ({
    ok: true,
    out: typeof out === "string" ? out : JSON.stringify(out),
    err: "",
  })
  const fail = () => ({ ok: false, out: "", err: "failed" })
  const ports = fakePorts({
    files: { "/tmp/opencv.worktrees/90-keep-my-search/body.md": BODY },
    run(cmd, a, options) {
      if (s.intercept) {
        const r = s.intercept(cmd, a, options, s)
        if (r) return r
      }
      if (cmd === "node") {
        s.checkEnv = options.env
        if (s.changeDuringCheck) s.tree = "changed"
        return s.checkOk ? ok("checks passed") : fail()
      }
      if (cmd === "git") {
        if (a[0] === "-C")
          return ok(a.includes("branch") ? s.mainBranch : s.mainDirty)
        if (a[0] === "status") return ok(s.dirty)
        if (a[0] === "rev-parse")
          return ok(a[1] === "HEAD^{tree}" ? s.tree : s.base)
        if (a[0] === "rev-list") return ok("1")
        if (a[0] === "merge-base") return ok("base-1")
        if (a[0] === "diff" && a.includes("--numstat"))
          return ok(s.numstat ?? "")
        if (a[0] === "diff" && a.includes("--diff-filter=D"))
          return ok((s.deleted ?? []).join("\0"))
        if (a[0] === "diff")
          return ok(s.changed.join(a.includes("-z") ? "\0" : "\n"))
        if (a[0] === "log") return ok(s.commits)
        if (a[0] === "ls-tree" && a.includes("-r"))
          return ok(
            (
              s.treeFiles ?? Array.from({ length: 200 }, (_, i) => `f${i}`)
            ).join("\0")
          )
        if (a[0] === "ls-tree") return ok("100644 blob sha\tfile")
        if (a[0] === "cat-file") {
          if (a[1] === "-s") return ok(String(s.size))
          if (a[1] === "blob") return ok("text")
          if (s.deleteCi && a[2].includes(":.github/workflows/ci.yml"))
            return fail()
          return ok()
        }
        if (a[0] === "check-attr")
          return ok(
            a
              .slice(a.indexOf("--") + 1)
              .map(
                (f) =>
                  `${f}: linguist-generated: ${s.generated?.includes(f) ? "set" : "unspecified"}`
              )
              .join("\n") || "file: linguist-generated: unspecified"
          )
        if (a[0] === "push") {
          if (s.changeDuringPush) s.tree = "changed"
          return s.pushOk ? ok() : fail()
        }
        if (a[0] === "fetch") return ok()
      }
      if (cmd === "gh") {
        const pair = a.slice(0, 2).join(" ")
        if (pair === "pr list") return ok(s.existing)
        if (pair === "issue view")
          return ok({
            title: "feat: Keep my search",
            state: s.issueState,
            labels: s.issueLabels.map((name) => ({ name })),
          })
        if (pair === "pr create")
          return s.createOk
            ? ok("https://github.com/Rickvu309/opencv/pull/91")
            : fail()
        if (pair === "pr view") return ok(s.pull)
        if (pair === "pr diff") return ok(s.changed.join("\n"))
        if (pair === "repo view") return ok("Rickvu309/opencv")
        if (pair === "api user") return ok("owner")
        if (a[0] === "api") return ok({ check_runs: s.checks })
        if (pair === "pr merge") {
          if (!s.queue) {
            s.pull.state = "MERGED"
            s.pull.mergeCommit = { oid: "merged-1" }
          }
          return ok()
        }
        if (pair === "issue close") {
          if (s.closeWorks) s.issueState = "CLOSED"
          return ok()
        }
      }
      throw new Error(`Unscripted command: ${cmd} ${a.join(" ")}`)
    },
  })
  const ctx = ctxFor(ports)
  return {
    s,
    ports,
    ctx,
    call: (...argv) => runCli(argv, ctx),
    effects: (cmd, verb) =>
      ports.effects.filter(
        (e) =>
          e.op === "proc" &&
          e.cmd === cmd &&
          (!verb || e.args.slice(0, verb.split(" ").length).join(" ") === verb)
      ),
  }
}
