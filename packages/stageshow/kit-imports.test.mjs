import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const kit = path.join(path.dirname(fileURLToPath(import.meta.url)), "src/kit")

const kitFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? kitFiles(path.join(dir, entry.name))
      : [path.join(dir, entry.name)]
  )

const RELATIVE_IMPORT = /(?:from|import)\s+["'](\.{1,2}\/[^"']+)["']/g

test("every relative import in the vendored kit names a file that ships with it", () => {
  const missing = kitFiles(kit)
    .filter((file) => /\.tsx?$/.test(file))
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(RELATIVE_IMPORT)]
        .map((match) => match[1])
        .filter((spec) => !existsSync(path.resolve(path.dirname(file), spec)))
        .map((spec) => `${path.relative(kit, file)} -> ${spec}`)
    )
  assert.deepEqual(missing, [])
})
