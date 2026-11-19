import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/dialog-enter-submits.mjs"

const ACCOUNT = "apps/web/src/features/settings/account-section.tsx"
const INTRODUCED = "506377b7d"

const dialog = (body) =>
  `export const View = () => <Dialog><DialogContent>${body}</DialogContent></Dialog>`

test("a dialog with a field and a primary button but no form fires", () => {
  assert.equal(
    detect(dialog(`<Input value={v} /><Button onClick={go}>Save</Button>`))
      .length,
    1
  )
  assert.equal(
    detect(
      `const A = () => <AlertDialogContent><Input /><Button variant="default">Go</Button></AlertDialogContent>`
    ).length,
    1
  )
})

test("a dialog whose field submits or has no primary action stays quiet", () => {
  assert.deepEqual(
    detect(
      dialog(
        `<form onSubmit={go}><Input /><Button type="submit">Save</Button></form>`
      )
    ),
    []
  )
  assert.deepEqual(
    detect(dialog(`<Input onKeyDown={onKey} /><Button>Open</Button>`)),
    []
  )
  assert.deepEqual(
    detect(
      dialog(
        `<Input /><Button variant="ghost">Close</Button><Button variant="outline">Back</Button>`
      )
    ),
    []
  )
  assert.deepEqual(detect(dialog(`<Button>Done</Button>`)), [])
  assert.deepEqual(
    detect(`const A = () => <div><Input /><Button>Go</Button></div>`),
    []
  )
})

test("the Change email dialog fired when Settings Account was introduced", () => {
  const historic = execFileSync("git", ["show", `${INTRODUCED}:${ACCOUNT}`], {
    encoding: "utf8",
  })
  assert.ok(detect(historic, ACCOUNT).length >= 1)
})

test("every app and kit dialog with a field submits on Enter", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "--", "apps/web/src/**/*.tsx", "packages/ui/src/**/*.tsx"],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter((file) => !/\.test\.tsx$/.test(file))
  assert.ok(files.includes(ACCOUNT))
  assert.deepEqual(
    files.flatMap((file) => detect(readFileSync(file, "utf8"), file)),
    []
  )
})
