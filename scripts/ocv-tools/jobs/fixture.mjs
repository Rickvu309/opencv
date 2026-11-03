import { ctxFor, fakePorts } from "../ports/fake.mjs"
import { runCli } from "../cli.mjs"

export const BODY =
  "## Summary\n\nA useful change.\n\n## Evidence\n\n`node --test scripts/x.test.mjs`: 4 pass.\n\n## Merge Danger\n\n**Door:** two-way\n**Blast Radius:** jobs\n"
export function fixture(over = {}) {
  const s = {
    tree: "tree-1",
    base: "base-1",
    dirty: "",
    mainDirty: "",
    mainBranch: "main",
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
    onPause: (total) => s.onPause?.(total, s),
    run(cmd, a, options) {
      if (s.intercept) {
        const r = s.intercept(cmd, a, options, s)
        if (r) return r
      }
      if (cmd === "git") {
        if (a[0] === "-C")
          return ok(a.includes("branch") ? s.mainBranch : s.mainDirty)
        if (a[0] === "status") return ok(s.dirty)
        if (a[0] === "rev-parse")
          return ok(a[1] === "HEAD^{tree}" ? s.tree : s.base)
        if (a[0] === "rev-list" && a.at(-1).endsWith("..origin/main"))
          return ok(String(s.behind ?? 0))
        if (a[0] === "rev-list") return ok("1")
        if (a[0] === "merge-tree") {
          const oid = "a".repeat(40)
          return s.conflicts?.length
            ? { ok: false, out: `${oid}\n${s.conflicts.join("\n")}`, err: "" }
            : ok(oid)
        }
        if (a[0] === "commit-tree") return ok("c".repeat(40))
        if (a[0] === "worktree") return ok()
        if (a[0] === "ls-tree" && a.includes("--name-only"))
          return ok(
            (s.guardFiles ?? ["scripts/guard-ledger.test.mjs"]).join("\n")
          )
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
        if (a[0] === "grep") {
          const pattern = new RegExp(a[3].replace("[[:space:]]", "\\s"))
          const hits = Object.entries(s.headFiles ?? {})
            .filter(([path, text]) => pattern.test(text) && path)
            .map(([path]) => `${a[4]}:${path}`)
          return hits.length
            ? ok(hits.join("\n"))
            : { ok: false, out: "", err: "" }
        }
        if (a[0] === "show")
          return ok(s.headFiles[a[1].slice(a[1].indexOf(":") + 1)])
      }
      if (cmd === "ln" || cmd === "rm") return ok()
      if (cmd === "stat") return ok("0")
      if (cmd === "timeout")
        return s.guardOutput
          ? { ok: false, out: s.guardOutput, err: "" }
          : ok("1 passed")
      if (cmd === "gh") {
        const pair = a.slice(0, 2).join(" ")
        if (pair === "pr list") return ok(s.existing)
        if (pair === "issue view")
          return ok({
            title: "feat: Keep my search",
            state: s.issueStates?.[a[2]] ?? s.issueState,
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
        if (pair === "api graphql") {
          const p = s.pull
          const inQueue =
            s.inQueue ?? (Boolean(s.enqueued) && s.queue && p.state === "OPEN")
          return ok({
            data: {
              repository: {
                pullRequest: {
                  state: p.state,
                  headRefOid: p.headRefOid,
                  mergeCommit: p.mergeCommit,
                  isInMergeQueue: Boolean(inQueue),
                  mergeQueueEntry: inQueue
                    ? {
                        state: s.queueState ?? "QUEUED",
                        position: 1,
                        headCommit: { oid: s.queuedHead ?? p.headRefOid },
                      }
                    : null,
                  headRef: {
                    target: {
                      statusCheckRollup: {
                        contexts: { nodes: s.rollup ?? [] },
                      },
                    },
                  },
                  timelineItems: {
                    nodes: (s.removedEvents ?? []).map((e) => ({
                      __typename: "RemovedFromMergeQueueEvent",
                      reason: e.reason,
                      createdAt: e.at,
                    })),
                  },
                },
              },
            },
          })
        }
        if (a[0] === "api" && /check-runs\/\d+\/annotations/.test(a[1]))
          return ok(s.annotations ?? [])
        if (a[0] === "api" && /actions\/runs\/\d+\/jobs/.test(a[1]))
          return ok({ jobs: s.runJobs ?? [] })
        if (a[0] === "api" && /actions\/runs\?/.test(a[1]))
          return ok({ workflow_runs: s.runs ?? [] })
        if (pair === "run rerun") return ok()
        if (a[0] === "api") return ok({ check_runs: s.checks })
        if (pair === "pr merge") {
          s.enqueued = true
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
