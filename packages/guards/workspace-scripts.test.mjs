import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))

function assertPackagesHaveScripts(packages, expectedScripts) {
  const missing = packages.flatMap(({ name, scripts = {} }) =>
    expectedScripts
      .filter((script) => !scripts[script])
      .map((script) => `${name}: ${script}`)
  )
  assert.deepEqual(
    missing,
    [],
    `workspace packages missing Turbo scripts: ${missing.join(", ")}`
  )
}

test("every workspace package defines the Turbo test script", () => {
  const packages = ["apps", "packages"].flatMap((group) =>
    readdirSync(path.join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        JSON.parse(
          readFileSync(
            path.join(root, group, entry.name, "package.json"),
            "utf8"
          )
        )
      )
  )
  assertPackagesHaveScripts(packages, ["test"])
})
