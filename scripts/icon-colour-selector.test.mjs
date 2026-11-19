import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { iconRecolourKeyedOnSize } from "./lib/icon-colour-selector.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MISTAKE = `const item = "[&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:text-muted-foreground"`

const CLEAN = `const item = "[&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground"`

test("a menu item that greys every icon without its own size fires", () => {
  assert.deepEqual(iconRecolourKeyedOnSize(MISTAKE), [
    {
      line: 1,
      selector: "svg:not([class*='size-'])]:text-muted-foreground",
    },
  ])
})

test("greying only icons without their own colour stays quiet", () => {
  assert.deepEqual(iconRecolourKeyedOnSize(CLEAN), [])
})

const productFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src",
      "packages/ui/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.(?:tsx?|css)$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

test("no app or kit class greys an icon that sets its own colour", () => {
  const problems = productFiles().flatMap((file) =>
    iconRecolourKeyedOnSize(readFileSync(path.join(root, file), "utf8")).map(
      ({ line, selector }) =>
        `${file}:${line} ${selector} recolours icons that set their own colour. Key the colour on text-, not size-.`
    )
  )
  assert.deepEqual(problems, [])
})
