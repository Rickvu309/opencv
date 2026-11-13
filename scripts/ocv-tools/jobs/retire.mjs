import { join } from "node:path"
import { decide, refusalError } from "../rules/index.mjs"
import { run, task } from "./common.mjs"
import { protectedFacts } from "./protected-facts.mjs"
import { RETIRED_DIR, retiredBy } from "./protected.mjs"
import { runnerOf, workspaceRunners } from "./test-runners.mjs"

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const CRASH =
  /ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError|ERR_UNRESOLVED_PACKAGE|Failed to load url/
const ASSERTED = /AssertionError|ERR_ASSERTION|^not ok|\bFAIL\b|✗|×/m

export function failedOnAssertion(output) {
  return !CRASH.test(output) && ASSERTED.test(output)
}

function gitIn(ctx, top, args) {
  const r = run(ctx, "git", args, { cwd: top })
  if (!r.ok)
    throw new Error(
      `git ${args.slice(0, 2).join(" ")} failed: ${r.err || r.out}`.slice(
        0,
        600
      )
    )
  return r.out
}

export function testCommand(ctx, top, file) {
  const manifests = gitIn(ctx, top, [
    "ls-files",
    "pnpm-workspace.yaml",
    "*package.json",
  ])
    .split("\n")
    .filter((path) => path && !path.includes("node_modules/"))
  const read = (path) => ctx.ports.fs.read(join(top, path))
  const { runners } = workspaceRunners({
    workspaceYaml: read("pnpm-workspace.yaml"),
    packageJsons: new Map(
      manifests
        .filter((path) => path.endsWith("package.json"))
        .map((path) => [path, read(path)])
    ),
  })
  const runner = runnerOf(file, runners)
  if (!runner) return null
  const dir = runner.dir ?? runner.name
  return {
    cmd: runner.cmd === "node" ? "node" : join(top, runner.cmd),
    args: [...runner.args, dir ? file.slice(dir.length + 1) : file],
    cwd: dir ? join(top, dir) : top,
  }
}

export function flipProof(ctx, top, { fork, changed, replacedBy, command }) {
  const restore = changed
    .filter(
      (item) =>
        item.baseBlob &&
        item.headBlob &&
        !TEST.test(item.path) &&
        !item.path.startsWith(`${RETIRED_DIR}/`)
    )
    .map((item) => item.path)
  const runTest = () => {
    const r = run(ctx, command.cmd, command.args, { cwd: command.cwd })
    return { ok: r.ok, output: `${r.out ?? ""}\n${r.err ?? ""}` }
  }
  let onBase = { ok: true, output: "no source file to restore" }
  if (restore.length) {
    gitIn(ctx, top, ["checkout", fork, "--", ...restore])
    try {
      onBase = runTest()
    } finally {
      gitIn(ctx, top, ["checkout", "HEAD", "--", ...restore])
    }
  }
  const onHead = runTest()
  return {
    fork,
    restored: restore.length,
    failedOnBase: !onBase.ok && failedOnAssertion(onBase.output),
    passedOnHead: onHead.ok,
    baseOutput: onBase.output,
  }
}

function retireRefusal(facts, problem, fix) {
  const verdict = decide("retire", {
    protected: facts ?? {},
    retireRun: { problem, fix },
  })
  return refusalError(verdict.refusals[0])
}

export function retire(ctx, args) {
  if (!args.subject || !args.because)
    throw new Error(
      'usage: ocv-tools retire "<subject>" --because "<why>" [--replaced-by <test file>]'
    )
  const t = task(ctx)
  return retireIn(ctx, t.top, t.n, args)
}

export function retireIn(
  ctx,
  top,
  n,
  { subject, because, replacedBy },
  { commandFor = (file) => testCommand(ctx, top, file) } = {}
) {
  const dirty = gitIn(ctx, top, ["status", "--porcelain"])
  if (dirty.trim())
    throw retireRefusal(
      null,
      "the worktree has uncommitted changes, so the flip proof cannot restore the fork point's files safely",
      'Commit first: git commit -am "<message>", then run retire again.'
    )
  const facts = protectedFacts(ctx, "origin/main", "HEAD", { cwd: top })
  const all = [...facts.weakened, ...facts.retired]
  const hits = all.filter((item) => retiredBy(item, [{ subject }]))
  if (!hits.length)
    throw retireRefusal(
      facts,
      `"${subject}" names nothing this branch weakens. Weakened now: ${
        all
          .slice(0, 8)
          .map((item) => item.subject)
          .join("; ") || "nothing"
      }`,
      "Copy one subject (or its file path, or a case title prefix) from the list."
    )
  if (hits.some((item) => item.kind === "acceptance"))
    throw retireRefusal(
      facts,
      "an acceptance test cannot be retired inside the pull request that builds against it",
      "Restore the acceptance file."
    )
  if (!replacedBy)
    return writeRetirement(
      ctx,
      top,
      n,
      { subject, because, replacedBy: null },
      [
        `Retired ${hits.length} weakening(s) under "${subject}" with no replacement test, so no machine can prove it.`,
        `Wrote ${RETIRED_DIR}/${n}.json. The pull request is owner class while it holds this retirement: it waits for the owner's yes.`,
      ]
    )
  const head = facts.changed.find((item) => item.path === replacedBy)
  if (!TEST.test(replacedBy) || !head?.headBlob)
    throw retireRefusal(
      facts,
      `${replacedBy} is not a test file this branch adds or edits`,
      "Write the test of the new behaviour first, commit it, then retire."
    )
  const command = commandFor(replacedBy)
  if (!command)
    throw retireRefusal(
      facts,
      `no test runner owns ${replacedBy}`,
      "Put the test in a package with a test runner."
    )
  const changed = facts.changed
  const prove = () =>
    flipProof(ctx, top, { fork: facts.base, changed, replacedBy, command })
  const locked = ctx.ports.lock
    ? ctx.ports.lock(prove)
    : { ok: true, value: prove() }
  if (!locked.ok) throw retireRefusal(facts, locked.reason, "Run retire again.")
  const proof = locked.value
  if (!proof.failedOnBase || !proof.passedOnHead)
    throw retireRefusal(
      facts,
      `${replacedBy} ${proof.passedOnHead ? "passes" : "fails"} on the head and ${proof.failedOnBase ? "fails on an assertion" : "does not fail on an assertion"} at the fork point with ${proof.restored} source file(s) put back; a replacement must fail before the change and pass after it`,
      proof.failedOnBase
        ? `Fix ${replacedBy} or the code until it passes on the head, commit, then run retire again.`
        : `Make ${replacedBy} assert the new behaviour this change makes (it must fail on the old code), commit, then run retire again; or retire without --replaced-by, which waits for the owner's yes.`
    )
  return writeRetirement(
    ctx,
    top,
    n,
    {
      subject,
      because,
      replacedBy,
      proof: {
        fork: proof.fork,
        replacedByBlob: head.headBlob,
        failedOnBase: true,
        passedOnHead: true,
      },
    },
    [
      `Retired ${hits.length} weakening(s) under "${subject}"; ${replacedBy} fails at ${proof.fork.slice(0, 8)} and passes on the head.`,
      `Wrote ${RETIRED_DIR}/${n}.json. If ${replacedBy} covers the same module, command or route and nothing retired is a ratchet, bound, guard, ledger row, checker setting or skip mark, the pull request still merges itself; finish and the body say "Retired N checks with replacements".`,
    ]
  )
}

function writeRetirement(ctx, top, n, row, lines) {
  const file = join(top, RETIRED_DIR, `${n}.json`)
  ctx.ports.fs.mkdir(join(top, RETIRED_DIR))
  let rows = []
  if (ctx.ports.fs.exists(file)) rows = JSON.parse(ctx.ports.fs.read(file))
  rows = rows.filter((item) => item.subject !== row.subject)
  rows.push(row)
  ctx.ports.fs.write(file, `${JSON.stringify(rows, null, 2)}\n`)
  return {
    lines,
    next: `scripts/ocv-tools.mjs save -m "test: retire ${row.subject.slice(0, 40)}"`,
  }
}
