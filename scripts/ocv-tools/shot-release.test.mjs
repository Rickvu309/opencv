import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { withTempDir } from "../lib/temp-dir.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"
import { runCli } from "./cli.mjs"
import { shotPlacement } from "./shot-release.mjs"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const digest = `sha256:${createHash("sha256").update(PNG).digest("hex")}`
const full = (count = 1000) =>
  Array.from({ length: count }, (_, i) => ({ name: `old-${i}.png` }))
const item = { asset: "issue-90-proof.png", type: "png", digest }

function run(world, check) {
  return withTempDir("shot-rollover-", (dir) => {
    const file = join(dir, "proof.png")
    writeFileSync(file, PNG)
    const ports = fakePorts({
      issues: [issue(90)],
      releases: ["screenshots"],
      ...world,
    })
    const ctx = ctxFor(ports)
    ctx.shotDir = join(dir, "staged")
    return check({
      ports,
      ctx,
      file,
      invoke: () => runCli(["shot", file, "--issue", "90"], ctx),
    })
  })
}

test("placement checks capacity after finding an identical existing asset", () => {
  assert.equal(shotPlacement(item, full()).full, true)
  assert.equal(shotPlacement(item, full(999)).full, false)
  const assets = [...full(999), { name: item.asset, digest }]
  assert.equal(shotPlacement(item, assets).exists, true)
  const different = shotPlacement(item, [
    { name: item.asset, digest: "sha256:old" },
  ])
  assert.match(different.item.asset, /proof-[a-f0-9]{64}\.png$/)
  assert.equal(different.exists, false)
})

test("full release rolls over and a retry finds its own asset without uploading again", () => {
  run({ releaseAssets: { screenshots: full() } }, ({ ports, invoke }) => {
    const first = invoke()
    assert.equal(first.code, 0, first.text)
    assert.match(first.text, /download\/screenshots-2\/issue-90-proof.png/)
    const before = ports.effects.filter(
      (entry) => entry.op === "releaseUpload"
    ).length
    const again = invoke()
    assert.equal(again.code, 0, again.text)
    assert.match(again.text, /download\/screenshots-2\/issue-90-proof.png/)
    assert.equal(
      ports.effects.filter((entry) => entry.op === "releaseUpload").length,
      before
    )
    assert.equal(ports.state.releaseAssets.screenshots.length, 1000)
    assert.equal(
      ports.effects.find((entry) => entry.op === "releaseCreate").prerelease,
      true
    )
  })
})

test("a changed picture keeps the old named asset intact and reuses its immutable link", () => {
  run(
    {
      releaseAssets: {
        screenshots: [{ name: item.asset, digest: "sha256:old" }],
      },
    },
    ({ ports, invoke }) => {
      const first = invoke()
      assert.equal(first.code, 0, first.text)
      assert.match(first.text, /proof-[a-f0-9]{64}\.png/)
      const next = invoke()
      assert.equal(next.code, 0, next.text)
      assert.equal(
        ports.effects.filter((entry) => entry.op === "releaseUpload").length,
        1
      )
      assert.equal(
        ports.state.releaseAssets.screenshots[0].digest,
        "sha256:old"
      )
      assert.equal(
        ports.effects.find((entry) => entry.op === "releaseUpload").clobber,
        false
      )
    }
  )
})

test("a concurrent creator and capacity race preserve the uploaded link", () => {
  run({ releases: [] }, ({ ports, invoke }) => {
    const create = ports.gh.releaseCreate
    ports.gh.releaseCreate = (...args) => {
      create(...args)
      if (args[0] === "screenshots") throw new Error("HTTP 422 already_exists")
    }
    const upload = ports.gh.releaseUpload
    let raced = false
    ports.gh.releaseUpload = (tag, files, options) => {
      if (!raced) {
        raced = true
        ports.state.releaseAssets[tag] = full()
        throw new Error("HTTP 422 file_count limited to 1000 assets")
      }
      assert.deepEqual(readFileSync(files[0]), PNG)
      return upload(tag, files, options)
    }
    const result = invoke()
    assert.equal(result.code, 0, result.text)
    assert.match(result.text, /download\/screenshots-2\/issue-90-proof.png/)
  })
})

test("a committed upload followed by an error is recovered without overwriting", () => {
  run({}, ({ ports, invoke }) => {
    const upload = ports.gh.releaseUpload
    ports.gh.releaseUpload = (...args) => {
      upload(...args)
      throw new Error("HTTP 422 already_exists")
    }
    const result = invoke()
    assert.equal(result.code, 0, result.text)
    assert.equal(
      ports.effects.filter((entry) => entry.op === "releaseUpload").length,
      1
    )
  })
})

test("a partial multi-picture upload is reused when the whole command retries", () => {
  run({}, ({ ports, ctx, file }) => {
    const second = join(file, "..", "second.png")
    writeFileSync(second, Buffer.concat([PNG, Buffer.from("second")]))
    const upload = ports.gh.releaseUpload
    let failed = false
    ports.gh.releaseUpload = (tag, files, options) => {
      if (files[0].endsWith("second.png") && !failed) {
        failed = true
        throw new Error("HTTP 503 unavailable")
      }
      return upload(tag, files, options)
    }
    const args = ["shot", file, second, "--issue", "90"]
    assert.equal(runCli(args, ctx).code, 1)
    const result = runCli(args, ctx)
    assert.equal(result.code, 0, result.text)
    assert.equal(ports.state.releaseAssets.screenshots.length, 2)
    assert.equal(
      ports.effects.filter((entry) => entry.op === "releaseUpload").length,
      2
    )
    assert.equal(
      ports.effects.filter((entry) => entry.op === "comment").length,
      1
    )
  })
})
