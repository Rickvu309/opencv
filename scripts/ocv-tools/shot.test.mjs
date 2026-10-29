import assert from "node:assert/strict"
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
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
    ...extra,
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
  const high = (bytes) => Buffer.from(bytes.map((b) => b | 0x80))
  assert.equal(pictureType(high(Buffer.from("GIF89a"))), null)
  assert.equal(pictureType(high(Buffer.from("GIF87a"))), null)
  assert.equal(pictureType(high(WEBP)), null)
  assert.equal(
    pictureType(
      Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0xff, 0x80, 0x00, 0x10]),
        Buffer.from("WEBP"),
      ])
    ),
    "webp"
  )
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
  const name = "n".repeat(60)
  const long = shotAssets(
    [
      { file: "/tmp/one.png", type: "png" },
      { file: "/tmp/two.jpg", type: "jpg" },
    ],
    { kind: "issue", n: 605, name }
  )
  assert.deepEqual(
    long.map((item) => item.asset),
    [`issue-605-${"n".repeat(38)}-1.png`, `issue-605-${"n".repeat(38)}-2.jpg`]
  )
  assert.equal(
    long[0].asset.slice("issue-605-".length, -".png".length).length,
    40
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
    writeFileSync(join(rig.stage, "keep.txt"), "keep")
    const orig = rig.ctx.run
    rig.ctx.run = (cmd, args) => {
      if (cmd === "gh" && args[0] === "release" && args[1] === "upload")
        assert.equal(
          readFileSync(join(rig.stage, "issue-90-dialog-1.png"))[0],
          0x89
        )
      return orig(cmd, args)
    }
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
    assert.equal(existsSync(join(rig.stage, "issue-90-dialog-1.png")), false)
    assert.equal(existsSync(join(rig.stage, "issue-90-dialog-2.jpg")), false)
    assert.equal(readFileSync(join(rig.stage, "keep.txt"), "utf8"), "keep")
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

function hugePicture(path) {
  const fd = openSync(path, "w")
  try {
    writeSync(fd, PNG)
    ftruncateSync(fd, 10 * 1024 * 1024 + 1)
  } finally {
    closeSync(fd)
  }
}

test("shot refuses a file over 10 MB and more than 20 pictures before any copy or upload", () => {
  const box = sandbox()
  const stage = mkdtempSync(join(tmpdir(), "ocv-shot-stage-"))
  try {
    const big = join(box.dir, "big.png")
    hugePicture(big)
    const ctx = fakeCtx([])
    ctx.shotDir = stage
    const tooBig = runCli(["shot", big, "--issue", "90"], ctx)
    assert.equal(tooBig.code, 2, tooBig.text)
    assert.match(tooBig.text, /REFUSED TOO_BIG/)
    assert.match(tooBig.text, /10 MB/)
    assert.match(tooBig.text, /\nFix: /)
    assert.deepEqual(ctx.calls, [])
    assert.deepEqual(readdirSync(stage), [])
    const files = Array.from({ length: 21 }, (_, i) =>
      box.file(`${i}.png`, PNG)
    )
    const many = fakeCtx([])
    many.shotDir = stage
    const tooMany = runCli(["shot", ...files, "--issue", "90"], many)
    assert.equal(tooMany.code, 2, tooMany.text)
    assert.match(tooMany.text, /REFUSED TOO_MANY/)
    assert.match(tooMany.text, /\nFix: /)
    assert.deepEqual(many.calls, [])
    assert.deepEqual(readdirSync(stage), [])
  } finally {
    box.done()
    rmSync(stage, { recursive: true, force: true })
  }
})

test("shot splits a long comment into chunks under 60000 characters", () => {
  const repo = `${"o".repeat(4000)}/opencv`
  const rig = ready([["repo view", JSON.stringify({ nameWithOwner: repo })]])
  try {
    const files = Array.from({ length: 20 }, (_, i) =>
      rig.box.file(`p${i}.png`, PNG)
    )
    const { code, text } = runCli(
      ["shot", ...files, "--issue", "90", "--name", "p"],
      rig.ctx
    )
    assert.equal(code, 0, text)
    const comments = rig.ctx.calls.filter((c) => c.includes("issue comment"))
    assert.ok(comments.length >= 2, comments.map((c) => c.length).join(","))
    for (const comment of comments) {
      const body = comment.slice(comment.indexOf("--body ") + "--body ".length)
      assert.ok(body.length < 60000, String(body.length))
      assert.match(body, /Pictures from the agent:/)
    }
    assert.equal(existsSync(join(rig.stage, "issue-90-p-1.png")), false)
  } finally {
    rig.done()
  }
})

test("shot removes staging copies when the upload fails", () => {
  const rig = ready([
    ["release upload", () => ({ ok: false, out: "", err: "upload failed" })],
  ])
  try {
    writeFileSync(join(rig.stage, "keep.txt"), "keep")
    const png = rig.box.file("plain.png", PNG)
    const orig = rig.ctx.run
    rig.ctx.run = (cmd, args) => {
      if (cmd === "gh" && args[0] === "release" && args[1] === "upload")
        assert.equal(existsSync(join(rig.stage, "issue-90-plain.png")), true)
      return orig(cmd, args)
    }
    const { code, text } = runCli(["shot", png, "--issue", "90"], rig.ctx)
    assert.equal(code, 1, text)
    assert.match(text, /upload failed/)
    assert.equal(existsSync(join(rig.stage, "issue-90-plain.png")), false)
    assert.equal(readFileSync(join(rig.stage, "keep.txt"), "utf8"), "keep")
  } finally {
    rig.done()
  }
})

test("help names the shot limits", () => {
  const { text } = runCli(["help"], fakeCtx([]))
  assert.match(text, /TOO_BIG/)
  assert.match(text, /TOO_MANY/)
  assert.match(text, /10 MB/)
  assert.match(text, /20 pictures/)
})
