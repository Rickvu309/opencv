import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { tempDir } from "../../lib/temp-dir.mjs"
import { evaluate, ownerBecause } from "../rules/index.mjs"
import { retiredLines } from "../rules/protected.mjs"
import { protectedFacts } from "./protected-facts.mjs"
import { retireIn } from "./retire.mjs"

const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("GIT_") && key !== "NODE_TEST_CONTEXT"
    )
  )

function runner(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    cwd: options.cwd,
    env: cleanEnv(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  })
  return {
    ok: r.status === 0,
    out: options.raw ? (r.stdout ?? "") : (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  }
}

function world(t) {
  const dir = tempDir(t, "retire-e2e-")
  const git = (...args) => {
    const r = runner("git", args, { cwd: dir })
    assert.ok(r.ok, `git ${args.join(" ")}: ${r.err}`)
    return r.out
  }
  const write = (path, text) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  const ctx = {
    cwd: dir,
    ports: {
      proc: { run: runner },
      fs: {
        read: (path) => readFileSync(path, "utf8"),
        write: (path, text) => writeFileSync(path, text),
        exists: (path) => existsSync(path),
        mkdir: (path) => mkdirSync(path, { recursive: true }),
      },
      lock: (fn) => ({ ok: true, value: fn() }),
    },
  }
  git("init", "-q", "-b", "main")
  if (!runner("git", ["config", "user.email"], { cwd: dir }).ok) {
    git("config", "user.email", "t@example.com")
    git("config", "user.name", "t")
  }
  write("lib/price.mjs", "export const price = (n) => n * 2\n")
  write(
    "lib/price.test.mjs",
    `import assert from "node:assert/strict"
import test from "node:test"
import { price } from "./price.mjs"
test("doubles a price", () => {
  assert.equal(price(2), 4)
})
test("keeps zero", () => {
  assert.equal(price(0), 0)
})
`
  )
  git("add", "-A")
  git("commit", "-q", "-m", "base")
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  write("lib/price.mjs", "export const price = (n) => n * 3\n")
  const commit = (message) => {
    git("add", "-A")
    git("commit", "-q", "-m", message)
  }
  const facts = () => protectedFacts(ctx, "origin/main", "HEAD", { cwd: dir })
  const retire = (args) =>
    retireIn(ctx, dir, 7, args, {
      commandFor: (file) => ({ cmd: "node", args: ["--test", file], cwd: dir }),
    })
  return { dir, git, write, commit, facts, retire }
}

const SUBJECT = "lib/price.test.mjs > doubles a price"

const replaced = (body) => `import assert from "node:assert/strict"
import test from "node:test"
import { price } from "./price.mjs"
test("keeps zero", () => {
  assert.equal(price(0), 0)
})
${body}`

const decided = (facts) => ({
  weakened: evaluate("PROTECTED_WEAKENED", { protected: facts }),
  unproven: evaluate("RETIRE_UNPROVEN", { protected: facts }),
  owner: ownerBecause({ diff: { files: [] }, protected: facts }),
  lines: retiredLines(facts),
})

test("a test of behaviour changed on purpose is retired self-serve when its replacement flips, and the pull request says so in one line", (t) => {
  const w = world(t)
  w.write(
    "lib/price.test.mjs",
    replaced(`test("triples a price", () => {
  assert.equal(price(2), 6)
})
`)
  )
  w.commit("change the price on purpose")
  assert.match(
    decided(w.facts()).weakened.message,
    /case-removed lib\/price\.test\.mjs > doubles a price/
  )
  const done = w.retire({
    subject: SUBJECT,
    because: "prices triple now",
    replacedBy: "lib/price.test.mjs",
  })
  assert.match(done.lines[0], /fails at [0-9a-f]{8} and passes on the head/)
  assert.equal(
    runner("git", ["status", "--porcelain", "lib"], { cwd: w.dir }).out,
    ""
  )
  w.commit("retire the doubling test")
  const after = decided(w.facts())
  assert.equal(after.weakened, null)
  assert.equal(after.unproven, null)
  assert.deepEqual(after.owner, [])
  assert.deepEqual(after.lines, [
    `Retired 1 checks with replacements: ${SUBJECT}`,
  ])
})

test("a replacement that already passes on the old code is refused with what to do, and nothing is written", (t) => {
  const w = world(t)
  w.write(
    "lib/price.test.mjs",
    replaced(`test("prices are numbers", () => {
  assert.equal(typeof price(2), "number")
})
`)
  )
  w.commit("change the price and write a weak replacement")
  assert.throws(
    () =>
      w.retire({
        subject: SUBJECT,
        because: "prices triple now",
        replacedBy: "lib/price.test.mjs",
      }),
    (error) =>
      error.code === "RETIRE_UNPROVEN" &&
      /does not fail on an assertion at the fork point/.test(error.message) &&
      /must fail on the old code/.test(error.fix) &&
      /without --replaced-by/.test(error.fix)
  )
  assert.equal(existsSync(join(w.dir, "scripts/retired/7.json")), false)
  assert.equal(runner("git", ["status", "--porcelain"], { cwd: w.dir }).out, "")
})

test("a check removed with no replacement is recorded, and the pull request becomes owner class", (t) => {
  const w = world(t)
  w.write("lib/price.test.mjs", replaced(""))
  w.commit("change the price and drop its test")
  const done = w.retire({
    subject: SUBJECT,
    because: "prices are set elsewhere",
  })
  assert.match(done.lines[1], /Owner class \(no replacement test\)/)
  w.commit("retire without a replacement")
  const after = decided(w.facts())
  assert.equal(after.weakened, null)
  assert.equal(after.unproven, null)
  assert.deepEqual(after.owner, [
    `${SUBJECT} is retired with no replacement test`,
  ])
  assert.deepEqual(after.lines, [
    `Retired 1 checks that wait for the owner: ${SUBJECT} (no replacement test)`,
  ])
  const file = join(w.dir, "scripts/retired/7.json")
  const rows = JSON.parse(readFileSync(file, "utf8"))
  assert.deepEqual(
    [rows[0].class, rows[0].classBecause, rows[0].items],
    ["owner", "no replacement test", 1]
  )
  writeFileSync(file, JSON.stringify([{ ...rows[0], class: "self" }]))
  w.commit("hand-edit the record to self-serve")
  assert.match(
    decided(w.facts()).unproven.message,
    /recorded as self-serve, but it retires a check that waits for the owner \(no replacement test\)/
  )
})

test("retire refuses a dirty worktree and a subject the branch does not weaken", (t) => {
  const w = world(t)
  w.commit("change the price only")
  assert.throws(
    () =>
      w.retire({
        subject: SUBJECT,
        because: "x",
        replacedBy: "lib/price.test.mjs",
      }),
    (error) =>
      error.code === "RETIRE_UNPROVEN" &&
      /names nothing this branch weakens/.test(error.message)
  )
  w.write("lib/note.txt", "x\n")
  assert.throws(
    () => w.retire({ subject: SUBJECT, because: "x" }),
    (error) => /uncommitted changes/.test(error.message)
  )
  rmSync(join(w.dir, "lib/note.txt"))
})
