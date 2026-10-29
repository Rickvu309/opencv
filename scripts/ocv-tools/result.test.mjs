// Both node and bash writers produce a schema-1 record that result-check accepts.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SCHEMA, writeResult } from "./result.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))
const checker = fileURLToPath(
  new URL("../lib/result-check.mjs", import.meta.url)
)
const resultSh = fileURLToPath(new URL("../lib/result.sh", import.meta.url))

function check(file, ...expects) {
  execFileSync("node", [checker, file, ...expects], { encoding: "utf8" })
}

test("result.sh and result.mjs write the same schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocv-result-schema-"))
  const prevDir = process.env.PR_RESULT_DIR
  const prevRepo = process.env.PR_RESULT_REPO
  process.env.PR_RESULT_DIR = dir
  process.env.PR_RESULT_REPO = "opencv"
  try {
    const bash = execFileSync(
      "bash",
      [
        "-c",
        `
          set -euo pipefail
          export PR_RESULT_DIR="$1" PR_RESULT_REPO=opencv HOME="$1"
          # shellcheck disable=SC1090
          source "$2"
          result_begin check schema-sh
          result_file a.txt
          result_ok "from bash" "scripts/ocv-tools.mjs help"
          result_write 0
        `,
        "_",
        dir,
        resultSh,
      ],
      { cwd: root, encoding: "utf8" }
    )
    const bashPath = bash
      .trim()
      .split("\n")
      .at(-1)
      .replace(/^RESULT_JSON: /, "")
    const nodePath = writeResult({
      script: "check",
      id: "schema-node",
      status: "ok",
      detail: "from node",
      next: "scripts/ocv-tools.mjs help",
      files: ["a.txt"],
      startedAt: new Date(),
    })
    const bashRecord = JSON.parse(readFileSync(bashPath, "utf8"))
    const nodeRecord = JSON.parse(readFileSync(nodePath, "utf8"))
    assert.deepEqual(Object.keys(bashRecord).sort(), [...SCHEMA.fields].sort())
    assert.deepEqual(
      Object.keys(nodeRecord).sort(),
      Object.keys(bashRecord).sort()
    )
    assert.equal(bashRecord.schema, 1)
    assert.equal(nodeRecord.schema, 1)
    assert.equal(bashRecord.script, "check")
    assert.equal(nodeRecord.script, "check")
    assert.equal(bashRecord.status, "ok")
    assert.equal(nodeRecord.status, "ok")
    assert.equal(bashRecord.cause, "none")
    assert.equal(nodeRecord.cause, "none")
    check(bashPath, "script=check", "status=ok", "cause=none", "id=schema-sh")
    check(nodePath, "script=check", "status=ok", "cause=none", "id=schema-node")
  } finally {
    if (prevDir === undefined) delete process.env.PR_RESULT_DIR
    else process.env.PR_RESULT_DIR = prevDir
    if (prevRepo === undefined) delete process.env.PR_RESULT_REPO
    else process.env.PR_RESULT_REPO = prevRepo
  }
})
