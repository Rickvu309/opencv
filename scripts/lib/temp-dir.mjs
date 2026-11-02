import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const live = new Set()
let hooked = false

function sweep() {
  for (const dir of live) rmSync(dir, { recursive: true, force: true })
  live.clear()
}

export function removeTempDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  live.delete(dir)
}

export function makeTempDir(prefix, root = tmpdir(), { create = true } = {}) {
  if (create) mkdirSync(root, { recursive: true })
  const dir = mkdtempSync(join(root, prefix))
  live.add(dir)
  if (!hooked) {
    hooked = true
    process.once("exit", sweep)
  }
  return dir
}

export function tempDir(t, prefix, root, options) {
  const dir = makeTempDir(prefix, root, options)
  t.after(() => removeTempDir(dir))
  return dir
}

export function withTempDir(prefix, run, root, options) {
  const dir = makeTempDir(prefix, root, options)
  let result
  try {
    result = run(dir)
  } catch (error) {
    removeTempDir(dir)
    throw error
  }
  if (result && typeof result.then === "function")
    return result.finally(() => removeTempDir(dir))
  removeTempDir(dir)
  return result
}
