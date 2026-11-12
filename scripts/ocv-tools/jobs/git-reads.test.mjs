import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { isolatedEnv, realRunner } from "../ports/proc.mjs"
import {
  selectAndAccount,
  selectionBetween,
  testsForPush,
} from "./affected-tests.mjs"
import {
  UnreadableGitOutput,
  blobId,
  gitBytes,
  hiddenFromStatus,
  parseBatch,
  parseRawDiff,
  parseTreeList,
  readTextBlobs,
} from "./git-reads.mjs"
import { RAW_CHANGED, push, world } from "./hook-world.mjs"
import { workspaceRunners } from "./test-runners.mjs"
import { MAX_PER_RUNNER } from "./test-selection.mjs"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const env = isolatedEnv(process.env)
const realCtx = (cwd) => ({ cwd, ports: { proc: { run: realRunner() } } })
const refuses = (fn, pattern) =>
  assert.throws(
    fn,
    (error) =>
      error instanceof UnreadableGitOutput &&
      (pattern.test(error.message) ||
        assert.fail(`${error.message} does not match ${pattern}`))
  )

function scratchRepo(t) {
  const dir = tempDir(t, "ocv-git-reads-")
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, env, input: "" }).toString().trim()
  git("init", "-q")
  const put = (path, content) => {
    const full = join(dir, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  const tree = () => {
    git("add", "-A")
    return git("write-tree")
  }
  put("pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n')
  put(
    "apps/web/package.json",
    JSON.stringify({ name: "web", scripts: { test: "vitest run" } })
  )
  put("apps/web/src/lib/account-api.ts", "export const a = 1\n")
  put(
    "apps/web/src/lib/account-api.test.ts",
    'import { a } from "./account-api.ts"\ntest("a", () => a)\n'
  )
  return { dir, git, put, tree, ctx: realCtx(dir) }
}

const picked = (selection) =>
  selection.groups.flatMap((group) => group.files.map((item) => item.file))

test("B1: a binary blob that sorts before a test no longer hides the test's imports, and an honest edit selects its own unit test", (t) => {
  const repo = scratchRepo(t)
  repo.put(
    "apps/web/public/apple-touch-icon.png",
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28])
  )
  repo.put(
    'apps/web/src/a b/it\'s "q" é.test.ts',
    'import "../lib/account-api.ts"\n'
  )
  const from = repo.tree()
  repo.put("apps/web/src/lib/account-api.ts", "export const a = 2\n")
  const selection = selectionBetween(repo.ctx, repo.dir, {
    from,
    to: repo.tree(),
  })
  assert.deepEqual(selection.changed, ["apps/web/src/lib/account-api.ts"])
  assert.deepEqual(picked(selection).sort(), [
    'apps/web/src/a b/it\'s "q" é.test.ts',
    "apps/web/src/lib/account-api.test.ts",
  ])
  assert.equal(selection.accounting.entries[0].rule, "tests")
})

test("B1 invariant: every test file this repository's index lists is read whole, byte for byte", () => {
  const listing = execFileSync("git", ["ls-files", "-s", "-z"], {
    cwd: REPO,
    env,
    maxBuffer: 64 * 1024 * 1024,
  })
  const entries = listing
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [, mode, oid, path] = line.match(/^(\d{6}) ([0-9a-f]+) \d\t(.*)$/s)
      return { mode, oid, path }
    })
    .filter((entry) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.path))
  assert.ok(entries.length > 300, `only ${entries.length} test files listed`)
  assert.deepEqual(
    entries.filter((entry) => !["100644", "100755"].includes(entry.mode)),
    []
  )
  const texts = readTextBlobs(realCtx(REPO), REPO, entries)
  assert.equal(texts.size, entries.length)
  for (const entry of entries)
    assert.equal(
      blobId(Buffer.from(texts.get(entry.path), "utf8"), entry.oid.length),
      entry.oid,
      entry.path
    )
  const select = (changed) =>
    picked(
      selectAndAccount({
        changed,
        tests: entries.map((entry) => entry.path),
        textOf: (file) => texts.get(file) ?? "",
        workspace: {
          workspaceYaml: execFileSync("git", ["show", ":pnpm-workspace.yaml"], {
            cwd: REPO,
            env,
          }).toString(),
          packageJsons: new Map(
            [
              "apps/api",
              "apps/web",
              "packages/domain",
              "packages/guards",
              "packages/paper-crdt",
              "packages/ui",
            ].map((dir) => [
              `${dir}/package.json`,
              execFileSync("git", ["show", `:${dir}/package.json`], {
                cwd: REPO,
                env,
              }).toString(),
            ])
          ),
        },
      })
    )
  assert.ok(
    select(["apps/web/src/lib/account-api.ts"]).includes(
      "apps/web/src/lib/account-api.test.ts"
    ),
    "H1: the web unit test of account-api is selected"
  )
  assert.ok(
    select(["scripts/list-checks.mjs"]).includes("scripts/checks-doc.test.mjs"),
    "H3: the scripts test that imports list-checks is selected"
  )
  assert.ok(
    select([
      "apps/web/src/features/app-shell/design/dock.styles.json",
    ]).includes(
      "apps/web/src/features/app-shell/app-shell-dock-parity.test.tsx"
    ),
    "N1: the test that imports a JSON fixture is selected"
  )
})

test("B2: a file that becomes a symlink is a type change and refuses the pass", (t) => {
  const repo = scratchRepo(t)
  const from = repo.tree()
  unlinkSync(join(repo.dir, "apps/web/src/lib/account-api.ts"))
  symlinkSync(
    "../../../../pnpm-workspace.yaml",
    join(repo.dir, "apps/web/src/lib/account-api.ts")
  )
  const to = repo.tree()
  refuses(
    () => selectionBetween(repo.ctx, repo.dir, { from, to }),
    /apps\/web\/src\/lib\/account-api\.ts has git status T \(its type changed/
  )
})

test("an added symlink, a symlinked test and a submodule each refuse instead of reading as nothing", (t) => {
  const repo = scratchRepo(t)
  const from = repo.tree()
  symlinkSync("account-api.ts", join(repo.dir, "apps/web/src/lib/alias.ts"))
  refuses(
    () => selectionBetween(repo.ctx, repo.dir, { from, to: repo.tree() }),
    /alias\.ts is a symlink in this change/
  )
  const linked = scratchRepo(t)
  const base = linked.tree()
  symlinkSync(
    "account-api.test.ts",
    join(linked.dir, "apps/web/src/lib/b.test.ts")
  )
  refuses(
    () =>
      selectionBetween(linked.ctx, linked.dir, {
        from: base,
        to: linked.tree(),
      }),
    /b\.test\.ts is a symlink/
  )
  const sub = scratchRepo(t)
  const before = sub.tree()
  sub.git(
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${"a".repeat(40)},apps/web/vendor`
  )
  refuses(
    () =>
      selectionBetween(sub.ctx, sub.dir, {
        from: before,
        to: sub.git("write-tree"),
      }),
    /apps\/web\/vendor is a submodule/
  )
})

test("a test file that is not UTF-8, an empty test file and a path that is not UTF-8 each refuse and name the file", (t) => {
  const latin = scratchRepo(t)
  const from = latin.tree()
  latin.put(
    "apps/web/src/lib/x.test.ts",
    Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a])
  )
  refuses(
    () => selectionBetween(latin.ctx, latin.dir, { from, to: latin.tree() }),
    /apps\/web\/src\/lib\/x\.test\.ts is not UTF-8 text/
  )
  const empty = scratchRepo(t)
  const base = empty.tree()
  empty.put("apps/web/src/lib/empty.test.ts", "")
  refuses(
    () =>
      selectionBetween(empty.ctx, empty.dir, { from: base, to: empty.tree() }),
    /apps\/web\/src\/lib\/empty\.test\.ts is empty/
  )
  const named = scratchRepo(t)
  const start = named.tree()
  writeFileSync(
    Buffer.concat([
      Buffer.from(join(named.dir, "apps/web/src/lib/caf")),
      Buffer.from([0xe9]),
      Buffer.from(".ts"),
    ]),
    "x\n"
  )
  refuses(
    () =>
      selectionBetween(named.ctx, named.dir, { from: start, to: named.tree() }),
    /has a path that is not UTF-8/
  )
})

test("a path with a newline, spaces and quotes is read whole under -z", (t) => {
  const repo = scratchRepo(t)
  const from = repo.tree()
  repo.put(
    'apps/web/src/lib/odd\nname "x".test.ts',
    'import "./account-api.ts"\n'
  )
  repo.put("apps/web/src/lib/account-api.ts", "export const a = 3\n")
  const selection = selectionBetween(repo.ctx, repo.dir, {
    from,
    to: repo.tree(),
  })
  assert.deepEqual(selection.changed.sort(), [
    "apps/web/src/lib/account-api.ts",
    'apps/web/src/lib/odd\nname "x".test.ts',
  ])
  assert.ok(picked(selection).includes("apps/web/src/lib/account-api.test.ts"))
  assert.ok(
    picked(selection).includes('apps/web/src/lib/odd\nname "x".test.ts')
  )
})

test("a cat-file answer that is short, long, out of step, missing or altered refuses", () => {
  const one = { oid: blobId("abc\n"), path: "a.test.ts" }
  const two = { oid: blobId("de\n"), path: "b.test.ts" }
  const answer = (oid, body) =>
    `${oid} blob ${Buffer.byteLength(body)}\n${body}\n`
  const whole = answer(one.oid, "abc\n") + answer(two.oid, "de\n")
  assert.equal(parseBatch(whole, [one, two]).size, 2)
  refuses(
    () => parseBatch(whole.slice(0, -3), [one, two]),
    /did not arrive whole/
  )
  refuses(
    () => parseBatch(answer(one.oid, "abc\n"), [one, two]),
    /stopped before b\.test\.ts: 1 of 2/
  )
  refuses(() => parseBatch(`${whole}x\n`, [one, two]), /more than the 2 files/)
  refuses(
    () =>
      parseBatch(answer(two.oid, "de\n") + answer(one.oid, "abc\n"), [
        one,
        two,
      ]),
    /out of step/
  )
  refuses(
    () => parseBatch(`${one.oid} missing\n`, [one]),
    /could not be read from the object store/
  )
  refuses(
    () => parseBatch(`${one.oid} blob 4\nabd\n\n`, [one]),
    /different bytes than git stores/
  )
  refuses(
    () => parseBatch(`${one.oid} blob x\nabc\n\n`, [one]),
    /did not arrive whole/
  )
})

test("a diff or tree listing that is partial, unknown or unparseable refuses", () => {
  assert.deepEqual(parseRawDiff(""), [])
  assert.equal(parseRawDiff(`${RAW_CHANGED}\0a.ts\0`)[0].path, "a.ts")
  refuses(() => parseRawDiff(`${RAW_CHANGED}\0a.ts`), /ended in the middle/)
  refuses(() => parseRawDiff(`${RAW_CHANGED}\0`), /without its path/)
  for (const status of ["U", "X", "C", "R", "T"])
    refuses(
      () => parseRawDiff(`${RAW_CHANGED.replace(/ M$/, ` ${status}`)}\0a.ts\0`),
      new RegExp(`a\\.ts has git status ${status}`)
    )
  refuses(() => parseRawDiff(`garbage\0a.ts\0`), /cannot read for a\.ts/)
  refuses(
    () =>
      parseRawDiff(
        `${RAW_CHANGED.replace(":100644 100644", ":100644 100664")}\0a.ts\0`
      ),
    /a\.ts is file mode 100664/
  )
  refuses(
    () => parseTreeList(`100644 blob ${"1".repeat(40)}\ta.ts`),
    /ended in the middle/
  )
  refuses(() => parseTreeList(`what\0`), /cannot read/)
})

test("a git read that fails, is killed or passes the buffer limit refuses instead of reading as empty", (t) => {
  const failing = {
    cwd: "/x",
    ports: {
      proc: { run: () => ({ ok: false, out: "", err: "fatal: bad object" }) },
    },
  }
  refuses(
    () => gitBytes(failing, "/x", ["diff"], { what: "git diff --raw" }),
    /git diff --raw failed.*bad object/
  )
  const killed = realRunner()("sh", ["-c", "kill -9 $$"], {})
  assert.equal(killed.ok, false)
  assert.match(killed.err, /SIGKILL/)
  const capped = realRunner()("git", ["ls-files", "-z"], {
    cwd: REPO,
    bytes: true,
    maxBuffer: 64,
  })
  assert.equal(capped.ok, false)
  assert.match(capped.err, /buffer limit/)
  const repo = scratchRepo(t)
  const from = repo.tree()
  repo.put("apps/web/src/lib/account-api.ts", "export const a = 9\n")
  const to = repo.tree()
  const silent = {
    cwd: repo.dir,
    ports: {
      proc: {
        run: (cmd, args, options) =>
          args[0] === "diff"
            ? { ok: true, out: Buffer.alloc(0), err: "" }
            : realRunner()(cmd, args, options),
      },
    },
  }
  refuses(
    () => selectionBetween(silent, repo.dir, { from, to }),
    /listed no changed file although/
  )
})

test("a workspace the tool cannot parse refuses and names the file", () => {
  const ok = {
    workspaceYaml: 'packages:\n  - "apps/*"\n',
    packageJsons: new Map([["apps/web/package.json", '{"name":"web"}']]),
  }
  assert.equal(workspaceRunners(ok).packages.length, 1)
  refuses(
    () =>
      workspaceRunners({
        ...ok,
        packageJsons: new Map([["apps/web/package.json", "{nope"]]),
      }),
    /apps\/web\/package\.json is not valid JSON/
  )
  refuses(
    () => workspaceRunners({ ...ok, workspaceYaml: undefined }),
    /lists no packages/
  )
  refuses(
    () => workspaceRunners({ ...ok, workspaceYaml: 'packages: ["apps/*"]\n' }),
    /lists no packages/
  )
  refuses(
    () =>
      workspaceRunners({
        ...ok,
        workspaceYaml: 'packages:\n  - "apps/*"\n  - "!apps/old"\n',
      }),
    /packages line the tool does not read: "- \\"!apps\/old\\""/
  )
})

test("NB1: a changed test dropped by the cap is UNKNOWN and needs its package suite", () => {
  const tests = Array.from(
    { length: MAX_PER_RUNNER + 5 },
    (_, i) => `apps/web/src/t${String(i).padStart(2, "0")}.test.ts`
  )
  const selection = selectAndAccount({
    all: true,
    changed: tests,
    tests,
    textOf: () => "",
    workspace: {
      workspaceYaml: 'packages:\n  - "apps/*"\n',
      packageJsons: new Map([
        [
          "apps/web/package.json",
          '{"name":"web","scripts":{"test":"vitest run"}}',
        ],
      ]),
    },
  })
  const unknown = selection.accounting.entries.filter(
    (entry) => entry.rule === "unknown"
  )
  assert.equal(unknown.length, 5)
  assert.match(unknown[0].says, /selected and not run here/)
  assert.deepEqual(
    selection.accounting.proofs.map((proof) => proof.args.join(" ")),
    ["--filter web test"]
  )
})

test("a push of a commit that is not HEAD refuses unless that commit has a recorded pass, and an unreadable status refuses", () => {
  const w = world({ changed: ["docs/a.md"] })
  const other = w.call(["pre-push"], {
    stdin: push(["refs/heads/feat/1-x", "def"]),
  })
  assert.equal(other.code, 2, other.text)
  assert.match(
    other.text,
    /def is pushed but is not the checked-out HEAD.*scripts\/ocv-tools\.mjs check/
  )
  const recorded = world({ changed: ["docs/a.md"], receipt: true })
  assert.equal(
    recorded.call(["pre-push"], { stdin: push(["refs/heads/feat/1-x", "def"]) })
      .code,
    0
  )
  const ctx = {
    cwd: "/repo",
    ports: {
      fs: { exists: () => false },
      proc: { run: () => ({ ok: false, out: "", err: "boom" }) },
    },
  }
  const result = testsForPush(ctx, "/repo", ["abc"])
  assert.match(result.unreadable[0], /HEAD could not be read \(boom\)/)
})

test("the commit and push quick checks refuse when git cannot list the staged or changed files, instead of checking none", () => {
  for (const prefix of [
    "diff --cached --name-only",
    "diff --name-only --no-renames -z",
    "diff --cached --no-renames --raw",
    "cat-file -s",
  ]) {
    const w = world({ staged: ["apps/web/src/a.ts"], gitFails: [prefix] })
    const r = w.call(["pre-commit"])
    assert.notEqual(r.code, 0, `${prefix}: ${r.text}`)
    assert.match(r.text, /could not be read|cannot be checked/, prefix)
  }
  const w = world({
    changed: ["apps/web/src/a.ts"],
    gitFails: ["diff --name-only --no-renames --diff-filter=ACMR"],
  })
  const r = w.call(["pre-push"], { stdin: push(["refs/heads/feat/1-x"]) })
  assert.notEqual(r.code, 0, r.text)
  assert.match(r.text, /git diff of the changed files failed/)
})

test("N2: renaming a module without updating its importers selects the importers of the old path", (t) => {
  const repo = scratchRepo(t)
  const from = repo.tree()
  repo.git(
    "mv",
    "apps/web/src/lib/account-api.ts",
    "apps/web/src/lib/accounts.ts"
  )
  const selection = selectionBetween(repo.ctx, repo.dir, {
    from,
    to: repo.tree(),
  })
  assert.deepEqual(selection.changed.sort(), [
    "apps/web/src/lib/account-api.ts",
    "apps/web/src/lib/accounts.ts",
  ])
  assert.ok(picked(selection).includes("apps/web/src/lib/account-api.test.ts"))
})

test("B1 real git: a hub with 13 test importers and a two-level import both change, and every importer is selected", (t) => {
  const repo = scratchRepo(t)
  repo.put("apps/web/src/lib/hub.ts", "export const hub = 1\n")
  repo.put("apps/web/src/lib/leaf.ts", "export const leaf = 1\n")
  repo.put("apps/web/src/lib/middle.ts", 'export { leaf } from "./leaf"\n')
  repo.put(
    "apps/web/src/features/deep.test.tsx",
    'import { leaf } from "@/lib/middle"\ntest("deep", () => leaf)\n'
  )
  const hubTests = Array.from(
    { length: 13 },
    (_, i) => `apps/web/src/hub/h${String(i).padStart(2, "0")}.test.ts`
  )
  for (const file of hubTests)
    repo.put(file, 'import { hub } from "../lib/hub"\ntest("h", () => hub)\n')
  const before = repo.tree()
  repo.put(
    "apps/web/src/lib/hub.ts",
    'export const hub = () => { throw new Error("broken") }\n'
  )
  repo.put(
    "apps/web/src/lib/leaf.ts",
    'export const leaf = () => { throw new Error("broken") }\n'
  )
  const after = repo.tree()
  const selection = selectionBetween(repo.ctx, repo.dir, {
    from: before,
    to: after,
  })
  const ran = picked(selection)
  for (const file of [...hubTests, "apps/web/src/features/deep.test.tsx"])
    assert.ok(ran.includes(file), `${file} imports a changed file and must run`)
  for (const entry of selection.accounting.entries)
    assert.equal(entry.rule, "tests", entry.file)
})

test("B2 real git: a skip-worktree or assume-unchanged file refuses, though git status is empty", (t) => {
  const repo = scratchRepo(t)
  repo.put(
    "apps/web/src/lib/account-api.test.ts",
    'test("committed copy fails", () => { throw new Error("review probe") })\n'
  )
  repo.tree()
  repo.git(
    "update-index",
    "--skip-worktree",
    "apps/web/src/lib/account-api.test.ts"
  )
  repo.put(
    "apps/web/src/lib/account-api.test.ts",
    'import { a } from "./account-api.ts"\ntest("a", () => a)\n'
  )
  assert.equal(repo.git("diff", "--name-only"), "")
  refuses(
    () => hiddenFromStatus(repo.ctx, repo.dir),
    /apps\/web\/src\/lib\/account-api\.test\.ts is marked skip-worktree.*--no-skip-worktree/
  )
  repo.git(
    "update-index",
    "--no-skip-worktree",
    "apps/web/src/lib/account-api.test.ts"
  )
  repo.tree()
  repo.git(
    "update-index",
    "--assume-unchanged",
    "apps/web/src/lib/account-api.ts"
  )
  refuses(
    () => hiddenFromStatus(repo.ctx, repo.dir),
    /account-api\.ts is marked assume-unchanged/
  )
  repo.git(
    "update-index",
    "--no-assume-unchanged",
    "apps/web/src/lib/account-api.ts"
  )
  assert.doesNotThrow(() => hiddenFromStatus(repo.ctx, repo.dir))
})

test("B2: pre-push records no pass while an index entry hides the worktree from git status", () => {
  const w = world({
    changed: ["scripts/a.test.mjs"],
    tests: ["scripts/a.test.mjs"],
    indexFlags: "H scripts/a.mjs\0S scripts/a.test.mjs\0",
  })
  const r = w.call(["pre-push"], { stdin: push(["refs/heads/feat/1-x"]) })
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /scripts\/a\.test\.mjs is marked skip-worktree/)
  assert.deepEqual(w.receipts(), [])
  assert.ok(!w.s.calls.some((call) => call.args.includes("--test")))
})
