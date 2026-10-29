import assert from "node:assert/strict"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { realRun } from "./core.mjs"
import { slugify } from "./worktree.mjs"
import { NOW, fakeCtx, issueData, minutesAgo, tempClone } from "./fake-ctx.mjs"

const claim = (agent, minutes, id = 1) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({
    agent,
    at: "client",
    branch: "feat/90-keep-my-search",
  }),
})

// Posted claim comments are appended so the re-read after posting sees them.
function ghRules(data, extra = []) {
  const posted = []
  return [
    ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
    [
      "api graphql",
      () => {
        const parsed = JSON.parse(typeof data === "function" ? data() : data)
        const issue = parsed.data.repository.issue
        const nodes = issue.comments?.nodes ?? []
        issue.comments = { nodes: [...nodes, ...posted] }
        return { ok: true, out: JSON.stringify(parsed), err: "" }
      },
    ],
    ["api user", "me"],
    ["issue edit", ""],
    [
      "issue comment",
      (line) => {
        const at = new Date(NOW).toISOString()
        posted.push({
          databaseId: 1000 + posted.length,
          createdAt: at,
          updatedAt: at,
          body: line.slice(line.indexOf("--body ") + 7),
        })
        return { ok: true, out: "", err: "" }
      },
    ],
    ...extra,
  ]
}

function realCtx(t, rules, env = {}) {
  const fake = fakeCtx(rules, {
    env: {
      PR_DISK_MIN_MB: "1",
      HOME: join(t.root, "home"),
      TMPDIR: t.root,
      PR_RESULT_DIR: join(t.root, "results"),
      ...env,
    },
  })
  return {
    ...fake,
    cwd: t.work,
    writeFile: (p, text) =>
      realRun("sh", ["-c", `printf %s "$1" > "$2"`, "_", text, p]),
    readFile: (p) => readFileSync(p, "utf8"),
    run: (cmd, args, options) =>
      cmd === "gh" ? fake.run(cmd, args) : realRun(cmd, args, options),
    ghCalls: fake.calls,
  }
}

test("slugify keeps the first five words", () => {
  assert.equal(
    slugify("Keep my search: now, please! Really long"),
    "keep-my-search-now-please"
  )
  assert.equal(slugify("!!!"), "")
})

test("take builds the branch, worktree, .env, port record, claim and result", () => {
  const t = tempClone()
  try {
    const ctx = realCtx(t, ghRules(issueData()))
    const r = runCli(["take", "90", "--no-install"], ctx)
    assert.equal(r.code, 0, r.text)
    const wt = join(t.root, "opencv.worktrees", "90-keep-my-search")
    assert.match(r.text, new RegExp(`Worktree: ${wt}`))
    assert.match(r.text, /Branch: feat\/90-keep-my-search/)
    assert.match(r.text, /Port: 4090 /)
    assert.match(readFileSync(join(wt, ".env"), "utf8"), /^PORT=4090$/m)
    assert.equal(
      t.sh(wt, "rev-parse", "--abbrev-ref", "HEAD").trim(),
      "feat/90-keep-my-search"
    )
    assert.equal(t.sh(t.work, "config", "core.hooksPath"), ".githooks\n")
    const gitDir = t.sh(wt, "rev-parse", "--absolute-git-dir").trim()
    assert.equal(
      readFileSync(join(gitDir, "assigned-port"), "utf8").trim(),
      "4090"
    )
    assert.match(
      readFileSync(join(gitDir, "ocv-tools-agent"), "utf8"),
      /^agent-/
    )
    assert.ok(
      ctx.ghCalls.some((c) => c.includes("issue edit 90 --add-assignee @me"))
    )
    assert.ok(
      ctx.ghCalls.some(
        (c) => c.includes("issue comment 90") && c.includes("ocv-tools claim")
      )
    )
    const last = r.text.split("\n").at(-1)
    assert.match(
      last,
      /^RESULT_JSON: .*opencv-new-task-feat-90-keep-my-search\.json$/
    )
    const json = JSON.parse(readFileSync(last.slice(13), "utf8"))
    assert.equal(json.status, "ok")
    assert.equal(json.script, "new-task")
    // a second take finds the worktree
    assert.match(
      runCli(["take", "90", "--no-install"], realCtx(t, ghRules(issueData())))
        .text,
      /REFUSED WORKTREE_EXISTS/
    )
  } finally {
    t.done()
  }
})

test("take picks the next free port when another worktree holds the first", () => {
  const t = tempClone()
  try {
    const first = realCtx(t, ghRules(issueData()))
    runCli(["take", "90", "--no-install"], first)
    const second = realCtx(
      t,
      ghRules(issueData({ title: "feat: Other thing here", number: 1090 }))
    )
    const r = runCli(["take", "1090", "--no-install"], second)
    assert.match(r.text, /Port: 4091 /, r.text)
  } finally {
    t.done()
  }
})

test("take refuses on low disk before touching gh writes, git or the worktree, and records cause disk", () => {
  const t = tempClone()
  try {
    const ctx = realCtx(t, ghRules(issueData()), {
      PR_DISK_MIN_MB: "999999999",
    })
    const r = runCli(["take", "90"], ctx)
    assert.equal(r.code, 2)
    assert.match(r.text, /REFUSED DISK: only \d+ MiB free/)
    assert.ok(!existsSync(join(t.root, "opencv.worktrees")))
    assert.ok(
      !ctx.ghCalls.some(
        (c) => c.includes("issue edit") || c.includes("issue comment")
      )
    )
    const json = JSON.parse(
      readFileSync(r.text.split("\n").at(-1).slice(13), "utf8")
    )
    assert.equal(json.status, "fail")
    assert.equal(json.cause, "disk")
  } finally {
    t.done()
  }
})

test("take --take overrides another assignee; a branch already on origin is refused", () => {
  const t = tempClone()
  try {
    const data = issueData({ assignees: { nodes: [{ login: "someone" }] } })
    t.sh(
      t.work,
      "push",
      "-q",
      "origin",
      "main:refs/heads/feat/90-keep-my-search"
    )
    const dup = runCli(
      ["take", "90", "--take", "--no-install"],
      realCtx(t, ghRules(data))
    )
    assert.match(dup.text, /REFUSED BRANCH_EXISTS.*origin/)
    t.sh(t.work, "push", "-q", "origin", ":refs/heads/feat/90-keep-my-search")
    const ok = runCli(
      ["take", "90", "--take", "--no-install", "-d", "my own words here"],
      realCtx(t, ghRules(data))
    )
    assert.equal(ok.code, 0, ok.text)
    assert.match(ok.text, /Branch: feat\/90-my-own-words-here/)
  } finally {
    t.done()
  }
})

test("take with a title files the issue first, then takes it", () => {
  const t = tempClone()
  try {
    const rules = ghRules(issueData(), [
      ["issue list", "[]"],
      ["issue create", "https://github.com/o/r/issues/90"],
    ])
    const ctx = realCtx(t, [rules[0], ...rules.slice(1).filter(Boolean)])
    const r = runCli(
      [
        "take",
        "feat: Keep my search",
        "--what",
        "The page forgets your search. This keeps it.",
        "--done",
        "- I come back and the box still has my words.",
        "--risk",
        "low",
        "--no-install",
      ],
      ctx
    )
    assert.equal(r.code, 0, r.text)
    assert.ok(
      ctx.ghCalls.findIndex((c) => c.includes("issue create")) <
        ctx.ghCalls.findIndex((c) => c.includes("issue comment"))
    )
    assert.match(r.text, /Branch: feat\/90-keep-my-search/)
  } finally {
    t.done()
  }
})

test("a title on low disk makes zero gh calls", () => {
  const t = tempClone()
  try {
    const ctx = realCtx(t, ghRules(issueData()), {
      PR_DISK_MIN_MB: "999999999",
    })
    const r = runCli(
      [
        "take",
        "fix: Cart total rounds wrong",
        "--what",
        "The total is wrong. This rounds it.",
        "--done",
        "- The cart shows the rounded total.",
        "--risk",
        "low",
      ],
      ctx
    )
    assert.match(r.text, /REFUSED DISK/)
    assert.equal(ctx.ghCalls.length, 0)
    assert.ok(!existsSync(join(t.root, "opencv.worktrees")))
  } finally {
    t.done()
  }
})

test("take --resume checks out a branch an idle holder already pushed", () => {
  const t = tempClone()
  try {
    t.sh(t.work, "checkout", "-q", "-b", "feat/90-keep-my-search")
    writeFileSync(join(t.work, "kept.txt"), "kept\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "kept")
    t.sh(t.work, "push", "-q", "origin", "feat/90-keep-my-search")
    t.sh(t.work, "checkout", "-q", "main")
    t.sh(t.work, "branch", "-D", "feat/90-keep-my-search")
    const data = issueData({ comments: { nodes: [claim("old", 400)] } })
    const refused = runCli(
      ["take", "90", "--no-install"],
      realCtx(t, ghRules(data))
    )
    assert.match(
      refused.text,
      /the idle holder old already pushed branch feat\/90-keep-my-search/
    )
    assert.match(refused.text, /Fix: scripts\/ocv-tools\.mjs take 90 --resume/)
    const ok = runCli(
      ["take", "90", "--resume", "--no-install"],
      realCtx(t, ghRules(data), { OCV_TOOLS_AGENT: "next" })
    )
    assert.equal(ok.code, 0, ok.text)
    const wt = join(t.root, "opencv.worktrees", "90-keep-my-search")
    assert.equal(
      t.sh(wt, "rev-parse", "--abbrev-ref", "HEAD").trim(),
      "feat/90-keep-my-search"
    )
    assert.equal(readFileSync(join(wt, "kept.txt"), "utf8"), "kept\n")
  } finally {
    t.done()
  }
})

test("take --resume fast-forwards a local branch that is behind origin", () => {
  const t = tempClone()
  try {
    const branch = "feat/90-keep-my-search"
    t.sh(t.work, "checkout", "-q", "-b", branch)
    writeFileSync(join(t.work, "kept.txt"), "base\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "base")
    t.sh(t.work, "push", "-q", "origin", branch)
    writeFileSync(join(t.work, "kept.txt"), "remote\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "remote tip")
    t.sh(t.work, "push", "-q", "origin", branch)
    t.sh(t.work, "reset", "--hard", "HEAD~1")
    t.sh(t.work, "checkout", "-q", "main")
    const data = issueData({ comments: { nodes: [claim("old", 400)] } })
    const ok = runCli(
      ["take", "90", "--resume", "--no-install"],
      realCtx(t, ghRules(data), { OCV_TOOLS_AGENT: "next" })
    )
    assert.equal(ok.code, 0, ok.text)
    const wt = join(t.root, "opencv.worktrees", "90-keep-my-search")
    assert.equal(readFileSync(join(wt, "kept.txt"), "utf8"), "remote\n")
    assert.match(t.sh(wt, "log", "-1", "--format=%s"), /remote tip/)
  } finally {
    t.done()
  }
})

test("take --resume refuses a local branch that diverged from origin", () => {
  const t = tempClone()
  try {
    const branch = "feat/90-keep-my-search"
    t.sh(t.work, "checkout", "-q", "-b", branch)
    writeFileSync(join(t.work, "kept.txt"), "base\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "base")
    t.sh(t.work, "push", "-q", "origin", branch)
    writeFileSync(join(t.work, "kept.txt"), "local\n")
    t.sh(t.work, "commit", "-aq", "-m", "local only")
    t.sh(t.work, "checkout", "-q", "--detach", "HEAD~1")
    writeFileSync(join(t.work, "kept.txt"), "remote\n")
    t.sh(t.work, "commit", "-aq", "-m", "remote only")
    t.sh(t.work, "push", "-q", "origin", `HEAD:${branch}`)
    t.sh(t.work, "checkout", "-q", "main")
    const data = issueData({ comments: { nodes: [claim("old", 400)] } })
    const r = runCli(
      ["take", "90", "--resume", "--no-install"],
      realCtx(t, ghRules(data), { OCV_TOOLS_AGENT: "next" })
    )
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, /REFUSED DIVERGED/)
    assert.match(r.text, /\nFix: /)
    assert.match(r.text, /git log --oneline --left-right/)
    assert.ok(
      !existsSync(join(t.root, "opencv.worktrees", "90-keep-my-search"))
    )
    assert.match(t.sh(t.work, "log", "-1", "--format=%s", branch), /local only/)
  } finally {
    t.done()
  }
})

test("after install, a live claim from someone else is HELD and the worktree is removed", () => {
  const t = tempClone()
  try {
    let reads = 0
    const rules = ghRules(issueData())
    const graphql = rules.find((r) => r[0] === "api graphql")
    const base = graphql[1]
    graphql[1] = () => {
      reads += 1
      if (reads >= 2)
        return {
          ok: true,
          out: issueData({ comments: { nodes: [claim("other", 1)] } }),
          err: "",
        }
      return base()
    }
    const ctx = realCtx(t, rules, { OCV_TOOLS_AGENT: "me" })
    const r = runCli(["take", "90", "--no-install"], ctx)
    assert.equal(r.code, 2, r.text)
    assert.match(r.text, /REFUSED HELD: #90 is held by other/)
    assert.match(r.text, /\nFix: /)
    assert.ok(!ctx.ghCalls.some((c) => c.includes("issue comment")))
    assert.ok(
      !existsSync(join(t.root, "opencv.worktrees", "90-keep-my-search"))
    )
  } finally {
    t.done()
  }
})

test("two clients: the later claim wins and the loser removes its worktree", () => {
  const t = tempClone()
  try {
    const comments = []
    let posts = 0
    const rules = [
      ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
      [
        "api graphql",
        () => ({
          ok: true,
          out: issueData({ comments: { nodes: comments } }),
          err: "",
        }),
      ],
      ["api user", "me"],
      ["issue edit", ""],
      [
        "issue comment",
        (line) => {
          posts += 1
          const at = new Date(NOW).toISOString()
          comments.push({
            databaseId: comments.length + 1,
            createdAt: at,
            updatedAt: at,
            body: line.slice(line.indexOf("--body ") + 7),
          })
          if (posts === 1)
            comments.push({
              databaseId: comments.length + 1,
              createdAt: at,
              updatedAt: at,
              body: claimMarker({
                agent: "beta",
                at: "server",
                branch: "feat/90-keep-my-search",
              }),
            })
          return { ok: true, out: "", err: "" }
        },
      ],
    ]
    const loser = runCli(
      ["take", "90", "--no-install"],
      realCtx(t, rules, { OCV_TOOLS_AGENT: "alpha" })
    )
    assert.equal(loser.code, 3, loser.text)
    assert.match(loser.text, /LOST #90: beta holds the claim now/)
    assert.match(loser.text, /\nFix: /)
    assert.ok(
      !existsSync(join(t.root, "opencv.worktrees", "90-keep-my-search"))
    )
    const winner = runCli(
      ["take", "90", "--no-install"],
      realCtx(t, rules, { OCV_TOOLS_AGENT: "beta" })
    )
    assert.equal(winner.code, 0, winner.text)
    assert.match(winner.text, /Agent: beta/)
    assert.ok(existsSync(join(t.root, "opencv.worktrees", "90-keep-my-search")))
  } finally {
    t.done()
  }
})
