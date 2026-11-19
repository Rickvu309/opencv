import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/centred-grid-track.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKE = `.paper-hand-stage {
  display: grid;
  justify-items: center;
  padding: 28px 36px 0;
}
`

const CLEAN = `.paper-hand-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  padding: 28px 36px 0;
}
`

test("MISTAKE: the Paper hand stage centred in an implicit auto column fires", () => {
  const hits = detect(MISTAKE, "paper-hand.css")
  assert.equal(hits.length, 1)
  assert.match(hits[0], /^paper-hand\.css:1 \.paper-hand-stage: /)
})

test("the same stage with a minmax(0, 1fr) column stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "paper-hand.css"), [])
})

test("a centred flex row and a grid that only aligns its items stay quiet", () => {
  assert.deepEqual(
    detect(
      `.row { display: flex; justify-items: center; }
.cell { display: grid; place-items: center; grid-template: 1fr / 1fr; }
.inline { display: inline-grid; align-items: center; }`,
      "quiet.css"
    ),
    []
  )
})

test("no tracked app or kit stylesheet centres a grid in an implicit auto column", () => {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps",
      "packages",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".css"))
    .filter((file) => existsSync(path.join(root, file)))
  assert.ok(files.length > 10)
  const hits = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(hits, [])
})
