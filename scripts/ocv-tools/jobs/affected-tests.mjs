import { run } from "./common.mjs"
import {
  REGULAR_MODES,
  UnreadableGitOutput,
  gitBytes,
  hiddenFromStatus,
  parseRawDiff,
  parseTreeList,
  readTextBlobs,
} from "./git-reads.mjs"
import { focusedCalls, isTestFile, workspaceRunners } from "./test-runners.mjs"
import { CODE_EXT } from "./import-graph.mjs"
import {
  COMMAND_FILES,
  LOCAL_CAP,
  MAX_PER_RUNNER,
  selectTests,
} from "./test-selection.mjs"
import {
  broadLine,
  accountFor,
  describeAccounting,
  proofCommand,
} from "./test-accounting.mjs"

export const RECEIPT_VERSION = "v3"
export const LOCAL_PRE_CHECK =
  "Local pre-check passed for the tests this change reaches; CI is the gate."
export const LOCAL_PRE_CHECK_PART =
  "Local pre-check passed for the part of this change it ran; CI runs the rest and is the gate."

export const passLines = ({ partial = [], deferred = [], ran = 0 } = {}) => [
  partial.length || deferred.length ? LOCAL_PRE_CHECK_PART : LOCAL_PRE_CHECK,
  ...partial.map(partialLine),
  ...(deferred.length ? [broadLine({ deferred, ran })] : []),
]
const LISTED = 30

export function selectAndAccount({
  changed,
  tests,
  textOf,
  workspace,
  changedLines,
  all = false,
}) {
  const { packages, runners } = workspaceRunners(workspace)
  for (const file of changed) {
    if (!isTestFile(file) || !tests.includes(file)) continue
    const focused = focusedCalls(file, textOf(file))
    if (focused.length)
      throw new UnreadableGitOutput(
        `${file} calls ${focused[0].call} at line ${focused[0].line}, so only the focused tests would run and the rest of the file would be skipped; remove the .only`
      )
  }
  const selection = selectTests({
    changed,
    tests,
    textOf,
    runners,
    changedLines,
  })
  return {
    changed,
    runners,
    ...selection,
    accounting: accountFor({
      changed,
      reach: selection.reach,
      packages,
      runners,
      ranByRunner: selection.ranByRunner,
      notRun: selection.notRun,
      unrun: selection.unrun,
      closures: selection.closures,
      imports: selection.imports,
      direct: selection.direct,
      all,
    }),
  }
}

const WORKSPACE_FILE = "pnpm-workspace.yaml"
const PACKAGE_JSON = /(?:^|\/)package\.json$/
const DIFF_ARGS = ["diff", "--raw", "-z", "--no-renames", "--no-abbrev"]
const TREE_ROOTS = ["apps", "packages", "scripts", WORKSPACE_FILE]

function changedBetween(ctx, top, from, to) {
  const entries = parseRawDiff(
    gitBytes(ctx, top, [...DIFF_ARGS, from, to], { what: "git diff --raw" })
  )
  if (entries.length) return entries
  const trees = gitBytes(
    ctx,
    top,
    ["rev-parse", `${from}^{tree}`, `${to}^{tree}`],
    {
      what: "git rev-parse of both trees",
    }
  )
    .toString("latin1")
    .trim()
    .split("\n")
  if (trees.length !== 2 || trees[0] !== trees[1])
    throw new UnreadableGitOutput(
      `git diff listed no changed file although ${from} and ${to} have different trees; run git diff --raw ${from} ${to} and look`
    )
  return entries
}

function trackedAt(ctx, top, rev) {
  const entries = parseTreeList(
    gitBytes(
      ctx,
      top,
      ["ls-tree", "-r", "-z", "--full-tree", rev, "--", ...TREE_ROOTS],
      {
        what: "git ls-tree",
      }
    )
  )
  for (const entry of entries)
    if (entry.type !== "blob")
      throw new UnreadableGitOutput(
        `${entry.path} is a ${entry.type === "commit" ? "submodule" : entry.type} the tool cannot read tests from; remove it or run pnpm --filter @workspace/guards test and say in the PR why it is safe`
      )
  const read = entries.filter(
    (entry) =>
      entry.path === WORKSPACE_FILE ||
      PACKAGE_JSON.test(entry.path) ||
      CODE_EXT.test(entry.path)
  )
  for (const entry of read)
    if (!REGULAR_MODES.includes(entry.mode))
      throw new UnreadableGitOutput(
        `${entry.path} is ${entry.mode === "120000" ? "a symlink" : `file mode ${entry.mode}`}, so the tool cannot read what it holds; make it a regular file`
      )
  if (!read.some((entry) => entry.path === WORKSPACE_FILE))
    throw new UnreadableGitOutput(
      `${WORKSPACE_FILE} is missing at ${rev}, so no package and no test runner can be found; restore it`
    )
  return { entries, read }
}

function changedLinesOf(ctx, top, from, to, files) {
  const lines = new Map()
  for (const file of files.filter((path) => COMMAND_FILES.test(path))) {
    const diff = gitBytes(
      ctx,
      top,
      ["diff", "-U0", "--no-color", "--no-ext-diff", from, to, "--", file],
      { what: "git diff -U0" }
    ).toString("utf8")
    const at = []
    for (const hunk of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
      const start = Number(hunk[1])
      const count = hunk[2] === undefined ? 1 : Number(hunk[2])
      for (let k = 0; k < Math.max(count, 1); k++) at.push(start + k)
    }
    lines.set(file, at)
  }
  return lines
}

export function selectionBetween(ctx, top, { from, to, all = false }) {
  const diff = changedBetween(ctx, top, from, to)
  const { entries, read } = trackedAt(ctx, top, to)
  const texts = readTextBlobs(ctx, top, read, {
    mayBeEmpty: (path) => !isTestFile(path) && CODE_EXT.test(path),
  })
  const manifests = read.filter(
    (entry) => entry.path === WORKSPACE_FILE || PACKAGE_JSON.test(entry.path)
  )
  const changed = diff.map((entry) => entry.path)
  return selectAndAccount({
    changed,
    changedLines: changedLinesOf(ctx, top, from, to, changed),
    all,
    tests: entries
      .map((entry) => entry.path)
      .filter((path) => !PACKAGE_JSON.test(path) && path !== WORKSPACE_FILE),
    textOf: (file) => texts.get(file) ?? "",
    workspace: {
      workspaceYaml: texts.get(WORKSPACE_FILE),
      packageJsons: new Map(
        manifests
          .filter((entry) => entry.path !== WORKSPACE_FILE)
          .map((entry) => [entry.path, texts.get(entry.path)])
      ),
    },
  })
}

export function branchSelection(ctx, top, { base, head, all = false }) {
  const fork = run(ctx, "git", ["merge-base", base, head], { cwd: top })
  if (!fork.ok || !fork.out)
    throw new UnreadableGitOutput(
      `the fork point of ${head} and ${base} could not be found (${fork.err || "no output"}); run git fetch origin main`
    )
  return selectionBetween(ctx, top, { from: fork.out, to: head, all })
}

export function describeSelection(selection) {
  const lines = []
  const total = selection.groups.reduce((n, g) => n + g.files.length, 0)
  const dropped = selection.groups.reduce((n, g) => n + g.dropped.length, 0)
  lines.push(
    `affected tests: ${total} test file(s) selected for ${selection.changed.length} changed file(s): changed tests, tests that scan a changed folder, and tests that import a changed file directly or through other files.`
  )
  const all = selection.groups.flatMap((g) => g.files)
  for (const item of all.slice(0, LISTED))
    lines.push(`  ${item.file}  (${item.why})`)
  if (all.length > LISTED) lines.push(`  ... and ${all.length - LISTED} more`)
  for (const group of selection.groups.filter((g) => g.dropped.length))
    lines.push(
      `affected tests: over ${MAX_PER_RUNNER} in ${group.runner}, so only changed tests, folder scanners and the ${LOCAL_CAP} nearest run here; ${group.dropped.length} more are left to CI (check --all runs the whole suite).`
    )
  for (const part of selection.partial ?? []) lines.push(partialLine(part))
  if (selection.accounting)
    lines.push(...describeAccounting(selection.accounting))
  return lines
}

export function affectedPlan(selection, top, { proofs = false } = {}) {
  const steps = selection.groups.map((group) => {
    const runner = selection.runners.find((r) => r.name === group.runner)
    const dir = runner.dir ?? runner.name
    const cwd = dir ? `${top}/${dir}` : top
    const files = group.files.map((item) =>
      dir ? item.file.slice(dir.length + 1) : item.file
    )
    const tool = runner.cmd === "node" ? "node" : `${top}/${runner.cmd}`
    return {
      label: `tests ${group.runner}`,
      cmd: tool,
      args: [...runner.args, ...files],
      tool,
      cwd,
      needsInstall: runner.cmd !== "node",
    }
  })
  if (!proofs) return steps
  const whole = new Set(
    selection.accounting.proofs.map((proof) => proof.args.join(" "))
  )
  const covered = (step) => {
    const runner = selection.runners.find(
      (r) => `tests ${r.name}` === step.label
    )
    return Boolean(runner?.pkg) && whole.has(`--filter ${runner.pkg} test`)
  }
  return [
    ...steps.filter((step) => !covered(step)),
    ...selection.accounting.proofs.map((proof) => ({
      label: proofCommand(proof),
      cmd: proof.cmd,
      args: proof.args,
      tool: proof.cmd,
      cwd: top,
      needsInstall: false,
    })),
  ]
}

export const receiptPath = (gitDir, head, tree) =>
  `${gitDir}/ocv-tools-affected-tests-${RECEIPT_VERSION}-${tree}-${head}`

export function hasReceipt(ctx, gitDir, head, tree) {
  return (
    Boolean(head && tree && gitDir) &&
    ctx.ports.fs.exists(receiptPath(gitDir, head, tree))
  )
}

function readOne(ctx, top, args, what) {
  const r = run(ctx, "git", args, { cwd: top })
  if (!r.ok || !r.out)
    throw new UnreadableGitOutput(
      `${what} could not be read (${r.err || "no output"}), so no pass can be recorded; run git ${args.join(" ")} and look`
    )
  return r.out
}

const treeOf = (ctx, top, rev = "HEAD") =>
  readOne(ctx, top, ["rev-parse", `${rev}^{tree}`], `the tree of ${rev}`)

const gitDirOf = (ctx, top) =>
  readOne(ctx, top, ["rev-parse", "--absolute-git-dir"], "the git directory")

function unreadableResult(error, lines = []) {
  if (!(error instanceof UnreadableGitOutput)) throw error
  return {
    failed: [],
    recorded: false,
    unreadable: [error.message],
    lines: [...lines, `affected tests: REFUSED, ${error.message}`],
  }
}

function unprovedResult(selection, lines) {
  const accounting = selection.accounting
  return {
    failed: [],
    recorded: false,
    unproved: accounting.entries
      .filter((entry) => entry.proofs.length)
      .map((entry) => entry.file),
    proofs: accounting.proofs.map(proofCommand),
    lines,
  }
}

export function runAffected(
  ctx,
  top,
  head,
  { proofs = false, all = false } = {}
) {
  let selection
  try {
    selection = branchSelection(ctx, top, {
      base: "origin/main",
      head,
      all,
    })
  } catch (error) {
    return unreadableResult(error)
  }
  const lines = describeSelection(selection)
  if (selection.accounting.proofs.length && !proofs)
    return unprovedResult(selection, lines)
  try {
    hiddenFromStatus(ctx, top)
  } catch (error) {
    return unreadableResult(error, lines)
  }
  const steps = affectedPlan(selection, top, { proofs })
  const runSteps = () => {
    const out = []
    for (const step of steps) {
      if (step.needsInstall && !ctx.ports.fs.exists(step.tool)) {
        out.push(
          `${step.label} (vitest is not installed here; run pnpm install in this worktree)`
        )
        continue
      }
      const r = run(ctx, step.cmd, step.args, { cwd: step.cwd, inherit: true })
      if (!r.ok) out.push(r.err ? `${step.label} (${r.err})` : step.label)
    }
    return out
  }
  const locked =
    steps.length && ctx.ports.lock
      ? ctx.ports.lock(runSteps)
      : { ok: true, value: runSteps() }
  if (!locked.ok)
    return {
      failed: [locked.reason],
      recorded: false,
      lines: [...lines, `affected tests: REFUSED, ${locked.reason}`],
    }
  const failed = locked.value
  let gitDir, tree
  try {
    gitDir = gitDirOf(ctx, top)
    tree = treeOf(ctx, top)
  } catch (error) {
    return { ...unreadableResult(error, lines), failed }
  }
  const status = run(ctx, "git", ["status", "--porcelain", "-z"], { cwd: top })
  if (!status.ok)
    return {
      ...unreadableResult(
        new UnreadableGitOutput(
          `git status failed (${status.err || "no output"}), so the tool cannot tell whether the tested files are the commit's files; run git status and look`
        ),
        lines
      ),
      failed,
    }
  const dirty = status.out
  const recorded = !failed.length && !dirty
  if (recorded)
    ctx.writeFile(
      receiptPath(gitDir, head, tree),
      `${JSON.stringify({
        version: RECEIPT_VERSION,
        head,
        tree,
        files: Object.fromEntries(
          selection.accounting.entries.map((e) => [e.file, e.rule])
        ),
        tests: selection.groups.flatMap((g) => g.files.map((f) => f.file)),
        proofs: selection.accounting.proofs.map(proofCommand),
        partial: selection.partial,
        deferred: selection.accounting.deferred,
        ran: selection.accounting.ran ?? 0,
      })}\n`
    )
  if (!failed.length && dirty)
    lines.push(
      "affected tests: passed, but the worktree has unsaved edits or untracked files, so no receipt was recorded for this commit."
    )
  return {
    failed,
    recorded,
    lines,
    partial: selection.partial,
    deferred: selection.accounting.deferred ?? [],
    ran: selection.accounting.ran ?? 0,
  }
}

function pushedWithoutRun(ctx, top, sha) {
  try {
    if (hasReceipt(ctx, gitDirOf(ctx, top), sha, treeOf(ctx, top, sha)))
      return null
  } catch (error) {
    if (!(error instanceof UnreadableGitOutput)) throw error
    return error.message
  }
  return `${sha.slice(0, 12)} is pushed but is not the checked-out HEAD, so its tests cannot run here; check out that commit, run scripts/ocv-tools.mjs check, and push again`
}

export function testsForPush(ctx, top, shas) {
  let head
  try {
    head = readOne(ctx, top, ["rev-parse", "HEAD"], "HEAD")
  } catch (error) {
    return unreadableResult(error)
  }
  const others = [...new Set(shas.filter((sha) => sha !== head))]
    .map((sha) => pushedWithoutRun(ctx, top, sha))
    .filter(Boolean)
  if (others.length)
    return {
      failed: [],
      recorded: false,
      unreadable: others,
      lines: others.map((reason) => `affected tests: REFUSED, ${reason}`),
    }
  if (!shas.includes(head))
    return {
      failed: [],
      lines: [
        "affected tests: every pushed commit already has a recorded pass, not run again.",
      ],
    }
  let recorded
  try {
    recorded = hasReceipt(ctx, gitDirOf(ctx, top), head, treeOf(ctx, top))
  } catch (error) {
    return unreadableResult(error)
  }
  if (recorded)
    return {
      failed: [],
      lines: [
        `affected tests: already passed at ${head.slice(0, 12)}, not run again.`,
      ],
    }
  return runAffected(ctx, top, head)
}

export function checkJob(ctx, flags) {
  const top = run(ctx, "git", ["rev-parse", "--show-toplevel"]).out || ctx.cwd
  if (flags["--list"]) {
    let selection
    try {
      selection = branchSelection(ctx, top, {
        base: flags["--base"] ?? "origin/main",
        head: flags["--head"] ?? "HEAD",
      })
    } catch (error) {
      if (error instanceof UnreadableGitOutput)
        throw new Error(`check --list refused: ${error.message}`)
      throw error
    }
    return {
      lines: describeSelection(selection),
      next: "scripts/ocv-tools.mjs check",
    }
  }
  const head = run(ctx, "git", ["rev-parse", "HEAD"], { cwd: top }).out
  return {
    head,
    ...runAffected(ctx, top, head, { proofs: true, all: !!flags["--all"] }),
  }
}

export const partialLine = (part) =>
  `Local pre-check ran ${part.ran} of ${part.reached} tests this change reaches in ${part.runner}; CI runs the rest (first left out: ${part.leftOut.join(", ")}).`
