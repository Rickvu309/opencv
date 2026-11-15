import assert from "node:assert/strict"
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue, pr } from "./ports/fake.mjs"
import { pictureType, shotAssets, shotLink } from "./shot.mjs"
import { makeTempDir } from "../lib/temp-dir.mjs"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const GIF = Buffer.from("GIF89aXXXX", "ascii")
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
])

function sandbox() {
  const dir = makeTempDir("ocv-shot-")
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

function ready(over = {}) {
  const box = sandbox()
  const stage = makeTempDir("ocv-shot-stage-")
  const ports = fakePorts({
    owner: "quanvu309",
    login: "quanvu309",
    issues: [issue(90), issue(1), issue(2)],
    prs: [pr(12), pr(1)],
    ...over,
  })
  const ctx = ctxFor(ports)
  ctx.shotDir = stage
  return {
    ports,
    ctx,
    box,
    stage,
    done() {
      box.done()
      rmSync(stage, { recursive: true, force: true })
    },
  }
}

const effect = (ports, op) => ports.effects.find((e) => e.op === op)
const effects = (ports, op) => ports.effects.filter((e) => e.op === op)

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
      ctxFor(fakePorts())
    )
    assert.equal(missing.code, 2)
    assert.match(missing.text, /REFUSED MISSING_FILE/)
    assert.match(missing.text, /\nFix: /)
    const bad = join(box.dir, "looks.png")
    writeFileSync(bad, "hello")
    const ports = fakePorts()
    const refused = runCli(["shot", bad, "--issue", "90"], ctxFor(ports))
    assert.equal(refused.code, 2)
    assert.match(refused.text, /REFUSED BAD_PICTURE/)
    assert.match(refused.text, /checked the file bytes/)
    assert.deepEqual(ports.effects, [])
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
    const orig = rig.ports.gh.releaseUpload
    rig.ports.gh.releaseUpload = (tag, files, options) => {
      assert.equal(
        readFileSync(files[0])[0],
        files[0].endsWith(".png") ? 0x89 : 0xff
      )
      return orig(tag, files, options)
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
    const create = effect(rig.ports, "releaseCreate")
    assert.equal(create.tag, "screenshots")
    assert.equal(create.prerelease, true)
    assert.equal(create.target, "main")
    const upload = effect(rig.ports, "releaseUpload")
    assert.equal(upload.clobber, false)
    assert.ok(
      effects(rig.ports, "releaseUpload").some((entry) =>
        entry.files.some((file) => file.endsWith("issue-90-dialog-1.png"))
      )
    )
    const comment = effect(rig.ports, "comment")
    assert.match(comment.body, /Pictures from the agent:/)
    assert.match(
      comment.body,
      /!\[dialog 1\]\(https:\/\/github.com\/quanvu309\/opencv\/releases\/download\/screenshots\/issue-90-dialog-1\.png\)/
    )
    assert.equal(existsSync(join(rig.stage, "issue-90-dialog-1.png")), false)
    assert.equal(existsSync(join(rig.stage, "issue-90-dialog-2.jpg")), false)
    assert.equal(readFileSync(join(rig.stage, "keep.txt"), "utf8"), "keep")
    assert.equal(effect(rig.ports, "commit"), undefined)
    assert.equal(effect(rig.ports, "push"), undefined)
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
    const comment = effect(rig.ports, "prComment")
    assert.match(
      comment.body,
      /releases\/download\/screenshots\/pr-12-shot\.webp/
    )
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
    assert.equal(effect(rig.ports, "comment"), undefined)
    assert.equal(effect(rig.ports, "prComment"), undefined)
  } finally {
    rig.done()
  }
})

test("shot does not create the release when it already exists", () => {
  const rig = ready({ releases: ["screenshots"] })
  try {
    const png = rig.box.file("plain.png", PNG)
    const { code } = runCli(["shot", png, "--issue", "90"], rig.ctx)
    assert.equal(code, 0)
    assert.ok(effect(rig.ports, "releaseAssets"))
    assert.equal(effect(rig.ports, "releaseCreate"), undefined)
  } finally {
    rig.done()
  }
})

test("shot refuses two targets, a bad number, a collision and a missing target", () => {
  const box = sandbox()
  try {
    const png = box.file("a.png", PNG)
    const both = runCli(
      ["shot", png, "--pr", "1", "--issue", "2"],
      ctxFor(fakePorts())
    )
    assert.equal(both.code, 2)
    assert.match(both.text, /REFUSED BAD_ARGS/)
    assert.equal(
      runCli(["shot", png, "--pr", "0"], ctxFor(fakePorts())).code,
      1
    )
    assert.equal(runCli(["shot"], ctxFor(fakePorts())).code, 1)
    assert.match(
      runCli(["shot", png, "--zoom"], ctxFor(fakePorts())).text,
      /UNKNOWN_FLAG/
    )
    const other = join(box.dir, "nested")
    mkdirSync(other)
    const second = join(other, "a.png")
    writeFileSync(second, PNG)
    const clashPorts = fakePorts()
    const clash = runCli(
      ["shot", png, second, "--issue", "90"],
      ctxFor(clashPorts)
    )
    assert.equal(clash.code, 2)
    assert.match(clash.text, /REFUSED BAD_PICTURE: two files would be named/)
    assert.deepEqual(clashPorts.effects, [])
    const gone = runCli(
      ["shot", png, "--issue", "90"],
      ctxFor(fakePorts({ issues: [], owner: "quanvu309" }))
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
  const stage = makeTempDir("ocv-shot-stage-")
  try {
    const big = join(box.dir, "big.png")
    hugePicture(big)
    const ports = fakePorts()
    const ctx = ctxFor(ports)
    ctx.shotDir = stage
    const tooBig = runCli(["shot", big, "--issue", "90"], ctx)
    assert.equal(tooBig.code, 2, tooBig.text)
    assert.match(tooBig.text, /REFUSED TOO_BIG/)
    assert.match(tooBig.text, /10 MB/)
    assert.match(tooBig.text, /\nFix: /)
    assert.deepEqual(ports.effects, [])
    assert.deepEqual(readdirSync(stage), [])
    const files = Array.from({ length: 21 }, (_, i) =>
      box.file(`${i}.png`, PNG)
    )
    const many = fakePorts()
    const manyCtx = ctxFor(many)
    manyCtx.shotDir = stage
    const tooMany = runCli(["shot", ...files, "--issue", "90"], manyCtx)
    assert.equal(tooMany.code, 2, tooMany.text)
    assert.match(tooMany.text, /REFUSED TOO_MANY/)
    assert.match(tooMany.text, /\nFix: /)
    assert.deepEqual(many.effects, [])
    assert.deepEqual(readdirSync(stage), [])
  } finally {
    box.done()
    rmSync(stage, { recursive: true, force: true })
  }
})

test("shot splits a long comment into chunks under 60000 characters", () => {
  const repo = `${"o".repeat(4000)}/opencv`
  const rig = ready({ nameWithOwner: repo })
  try {
    const files = Array.from({ length: 20 }, (_, i) =>
      rig.box.file(`p${i}.png`, PNG)
    )
    const { code, text } = runCli(
      ["shot", ...files, "--issue", "90", "--name", "p"],
      rig.ctx
    )
    assert.equal(code, 0, text)
    const comments = effects(rig.ports, "comment")
    assert.ok(comments.length >= 2, String(comments.length))
    for (const comment of comments) {
      assert.ok(comment.body.length < 60000, String(comment.body.length))
      assert.match(comment.body, /Pictures from the agent:/)
    }
    assert.equal(existsSync(join(rig.stage, "issue-90-p-1.png")), false)
  } finally {
    rig.done()
  }
})

test("shot removes staging copies when the upload fails", () => {
  const rig = ready({ uploadErr: "upload failed" })
  try {
    writeFileSync(join(rig.stage, "keep.txt"), "keep")
    const png = rig.box.file("plain.png", PNG)
    const orig = rig.ports.gh.releaseUpload
    rig.ports.gh.releaseUpload = (tag, files, options) => {
      assert.equal(existsSync(files[0]), true)
      return orig(tag, files, options)
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
  const { text } = runCli(["help"], ctxFor(fakePorts()))
  assert.match(text, /TOO_BIG/)
  assert.match(text, /TOO_MANY/)
  assert.match(text, /10 MB/)
  assert.match(text, /20 pictures/)
})

test("shot keeps a full existing release and links the new picture from the next release", () => {
  const rig = ready({ releases: ["screenshots"] })
  try {
    const read = rig.ports.gh.releaseAssets
    const oldAssets = Array.from({ length: 1000 }, (_, i) => ({
      name: `old-${i}.png`,
    }))
    rig.ports.gh.releaseAssets = (tag) =>
      tag === "screenshots" ? oldAssets : read(tag)
    const png = rig.box.file("proof.png", PNG)
    const { code, text } = runCli(["shot", png, "--issue", "90"], rig.ctx)
    assert.equal(code, 0, text)
    assert.match(text, /releases\/download\/screenshots-2\/issue-90-proof\.png/)
    assert.deepEqual(
      effects(rig.ports, "releaseCreate").map((entry) => entry.tag),
      ["screenshots-2"]
    )
    assert.equal(oldAssets.length, 1000)
    assert.equal(effects(rig.ports, "releaseUpload")[0].clobber, false)
  } finally {
    rig.done()
  }
})
