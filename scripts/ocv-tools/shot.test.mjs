import assert from "node:assert/strict"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { fakeCtx } from "./fake-ctx.mjs"
import { pictureType, shotAssets, shotLink } from "./shot.mjs"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const GIF = Buffer.from("GIF89aXXXX", "ascii")
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
])

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "ocv-shot-"))
  return {
    dir,
    file(name, bytes) {
      const path = join(dir, name)
      writeFileSync(path, bytes)
      return path
    },
    done() {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

function taskGit(branch = "feat/90-keep") {
  return [
    "rev-parse",
    (line) => {
      if (line.includes("--abbrev-ref"))
        return { ok: true, out: branch, err: "" }
      if (line.includes("--absolute-git-dir"))
        return { ok: true, out: "/repo/.git/worktrees/90", err: "" }
      if (line.includes("--git-common-dir"))
        return { ok: true, out: "/repo/.git", err: "" }
      if (line.includes("--show-toplevel"))
        return { ok: true, out: "/repo.worktrees/90-keep", err: "" }
      return { ok: false, out: "", err: `unmocked: ${line}` }
    },
  ]
}

function ready(extra = []) {
  const box = sandbox()
  const stage = mkdtempSync(join(tmpdir(), "ocv-shot-stage-"))
  const ctx = fakeCtx([
    taskGit(),
    ["repo view", '{"nameWithOwner":"quanvu309/opencv"}'],
    ["issue view", '{"number":90}'],
    ["pr view", '{"number":12}'],
    [
      "release create",
      "https://github.com/quanvu309/opencv/releases/tag/screenshots",
    ],
    ["release upload", ""],
    ["issue comment", ""],
    ["pr comment", ""],
    ...extra,
  ])
  ctx.shotDir = stage
  return {
    ctx,
    box,
    stage,
    done() {
      box.done()
      rmSync(stage, { recursive: true, force: true })
    },
  }
}

test("pictureType reads magic bytes and ignores the name", () => {
  assert.equal(pictureType(PNG), "png")
  assert.equal(pictureType(JPG), "jpg")
  assert.equal(pictureType(GIF), "gif")
  assert.equal(pictureType(Buffer.from("GIF87a")), "gif")
  assert.equal(pictureType(WEBP), "webp")
  assert.equal(pictureType(Buffer.from("RIFF....WAVE")), null)
  assert.equal(pictureType(Buffer.from("not a picture")), null)
  assert.equal(pictureType(Buffer.from([0xff, 0xd8])), null)
})

test("shotAssets names files by the target so two tasks do not collide", () => {
  const items = shotAssets(
    [
      { file: "/tmp/Login.png", type: "png" },
      { file: "/tmp/note.jpg", type: "jpg" },
    ],
    { kind: "issue", n: 90, name: "dialog" }
  )
  assert.deepEqual(
    items.map((item) => item.asset),
    ["issue-90-dialog-1.png", "issue-90-dialog-2.jpg"]
  )
  assert.equal(
    shotLink("quanvu309/opencv", items[0]),
    "![dialog 1](https://github.com/quanvu309/opencv/releases/download/screenshots/issue-90-dialog-1.png)"
  )
})

test("shot refuses a missing file and a non-picture before any gh or git call", () => {
  const box = sandbox()
  try {
    const missing = runCli(
      ["shot", join(box.dir, "nope.png"), "--issue", "90"],
      fakeCtx([])
    )
    assert.equal(missing.code, 2)
    assert.match(missing.text, /REFUSED MISSING_FILE/)
    assert.match(missing.text, /\nFix: /)
    const bad = join(box.dir, "looks.png")
    writeFileSync(bad, "hello")
    const ctx = fakeCtx([])
    const refused = runCli(["shot", bad, "--issue", "90"], ctx)
    assert.equal(refused.code, 2)
    assert.match(refused.text, /REFUSED BAD_PICTURE/)
    assert.match(refused.text, /checked the file bytes/)
    assert.deepEqual(ctx.calls, [])
  } finally {
    box.done()
  }
})

test("shot uploads to the screenshots prerelease and posts markdown links", () => {
  const rig = ready()
  try {
    const png = rig.box.file("Login Page.png", PNG)
    const jpg = rig.box.file("wide.jpg", JPG)
    const { code, text } = runCli(
      ["shot", png, jpg, "--issue", "90", "--name", "dialog"],
      rig.ctx
    )
    assert.equal(code, 0, text)
    assert.match(text, /not committed/)
    assert.match(text, /issue-90-dialog-1\.png/)
    assert.match(text, /issue-90-dialog-2\.jpg/)
    assert.match(text, /Commented on #90/)
    assert.match(text, /\nNext: Pictures are on #90/)
    const create = rig.ctx.calls.find((c) => c.includes("release create"))
    assert.match(create, /release create screenshots/)
    assert.match(create, /--prerelease/)
    assert.match(create, /--target main/)
    const upload = rig.ctx.calls.find((c) => c.includes("release upload"))
    assert.match(upload, /release upload screenshots/)
    assert.match(upload, /--clobber/)
    assert.match(upload, /issue-90-dialog-1\.png/)
    const comment = rig.ctx.calls.find((c) => c.includes("issue comment"))
    assert.match(comment, /--body Pictures from the agent:/)
    assert.match(
      comment,
      /!\[dialog 1\]\(https:\/\/github.com\/quanvu309\/opencv\/releases\/download\/screenshots\/issue-90-dialog-1\.png\)/
    )
    assert.equal(
      readFileSync(join(rig.stage, "issue-90-dialog-1.png"))[0],
      0x89
    )
    assert.ok(!rig.ctx.calls.some((c) => /git (add|commit|push)/.test(c)))
    assert.ok(!rig.ctx.calls.some((c) => c.includes("rev-parse")))
  } finally {
    rig.done()
  }
})

test("shot accepts gif and webp by bytes, including a misnamed file", () => {
  const rig = ready()
  try {
    const gif = rig.box.file("anim.gif", GIF)
    const webp = rig.box.file("shot.txt", WEBP)
    const { code, text } = runCli(["shot", gif, webp, "--pr", "12"], rig.ctx)
    assert.equal(code, 0, text)
    assert.match(text, /pr-12-anim\.gif/)
    assert.match(text, /pr-12-shot\.webp/)
    const comment = rig.ctx.calls.find((c) => c.includes("pr comment 12"))
    assert.match(comment, /releases\/download\/screenshots\/pr-12-shot\.webp/)
    assert.match(text, /\nNext: Pictures are on pull request #12/)
  } finally {
    rig.done()
  }
})

test("shot defaults to the worktree issue and skips the comment with --no-comment", () => {
  const rig = ready()
  try {
    const png = rig.box.file("plain.png", PNG)
    const { code, text } = runCli(["shot", png, "--no-comment"], rig.ctx)
    assert.equal(code, 0, text)
    assert.match(text, /issue-90-plain\.png/)
    assert.match(text, /No comment posted/)
    assert.ok(!rig.ctx.calls.some((c) => c.includes("comment")))
    assert.ok(rig.ctx.calls.some((c) => c.includes("--abbrev-ref")))
  } finally {
    rig.done()
  }
})

test("shot does not create the release when it already exists", () => {
  const rig = ready([["release view", '{"tagName":"screenshots"}']])
  try {
    const png = rig.box.file("plain.png", PNG)
    const { code } = runCli(["shot", png, "--issue", "90"], rig.ctx)
    assert.equal(code, 0)
    assert.ok(rig.ctx.calls.some((c) => c.includes("release view")))
    assert.ok(!rig.ctx.calls.some((c) => c.includes("release create")))
  } finally {
    rig.done()
  }
})

test("shot refuses two targets, a bad number, a collision and a missing target", () => {
  const box = sandbox()
  try {
    const png = box.file("a.png", PNG)
    const both = runCli(["shot", png, "--pr", "1", "--issue", "2"], fakeCtx([]))
    assert.equal(both.code, 2)
    assert.match(both.text, /REFUSED BAD_ARGS/)
    assert.equal(runCli(["shot", png, "--pr", "0"], fakeCtx([])).code, 1)
    assert.equal(runCli(["shot"], fakeCtx([])).code, 1)
    assert.match(
      runCli(["shot", png, "--zoom"], fakeCtx([])).text,
      /UNKNOWN_FLAG/
    )
    const other = join(box.dir, "nested")
    mkdirSync(other)
    const second = join(other, "a.png")
    writeFileSync(second, PNG)
    const clash = runCli(["shot", png, second, "--issue", "90"], fakeCtx([]))
    assert.equal(clash.code, 2)
    assert.match(clash.text, /REFUSED BAD_PICTURE: two files would be named/)
    const gone = runCli(
      ["shot", png, "--issue", "90"],
      fakeCtx([["repo view", '{"nameWithOwner":"quanvu309/opencv"}']])
    )
    assert.equal(gone.code, 2)
    assert.match(gone.text, /REFUSED NOT_AN_ISSUE/)
  } finally {
    box.done()
  }
})
