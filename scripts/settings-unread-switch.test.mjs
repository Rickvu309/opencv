import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  READ_SETTING_KEYS,
  SETTINGS_SCREEN_DIR,
  detect,
  isReaderFile,
  keysWithoutReader,
} from "./lib/settings-unread-switch.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const INTRODUCED = "506377b7d0f1744f14c1ee89f26126325152b85e"
const PREFERENCES = "apps/web/src/features/settings/preferences-section.tsx"

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60_000,
  })

const tracked = (...paths) =>
  git("ls-files", "--", ...paths)
    .split("\n")
    .filter(Boolean)

const current = (file) => readFileSync(path.join(root, file), "utf8")

const EMAIL_TOGGLE = `
  <SettingsRow
    id="notify-email"
    label="Email"
    onClick={() => onSave({ notifyEmail: !profile.notifyEmail })}
    control={<StateWord on={profile.notifyEmail} chevron />}
  />
`

const MEMORY_SWITCH = `
  <Switch
    aria-label="Enable memory"
    checked={profile.memoryEnabled}
    onCheckedChange={(memoryEnabled) => onSave({ memoryEnabled })}
  />
`

test("an Email notification toggle whose setting nothing reads fires", () => {
  const problems = detect(EMAIL_TOGGLE, PREFERENCES)
  assert.equal(problems.length, 1, problems.join("\n"))
  assert.match(problems[0], /"notifyEmail", which no product code reads/)
})

test("a weekly plan listed among the Coach capabilities fires", () => {
  const problems = detect(`{ key: "agentWeekly", label: "Weekly plan" }`)
  assert.match(problems.join("\n"), /"agentWeekly"/)
})

test("the memory switch, which the Coach reads, stays quiet", () => {
  assert.deepEqual(detect(MEMORY_SWITCH, PREFERENCES), [])
})

test("the Preferences screen where the toggles were introduced fires", () => {
  const past = git("show", `${INTRODUCED}:${PREFERENCES}`)
  const keys = detect(past, PREFERENCES).join("\n")
  assert.match(keys, /"notifyEmail"/)
  assert.match(keys, /"notifyBrowser"/)
})

test("no Settings screen file offers a setting nothing reads", () => {
  const files = tracked(SETTINGS_SCREEN_DIR).filter(
    (file) => /\.tsx?$/.test(file) && !/\.test\./.test(file)
  )
  assert.ok(files.includes(PREFERENCES), files.join("\n"))
  const problems = files.flatMap((file) => detect(current(file), file))
  assert.deepEqual(problems, [])
})

test("every key listed as read has a reader outside the store, schema, contract and Settings screen", () => {
  const files = tracked("apps", "packages")
    .filter(isReaderFile)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .map((file) => ({ path: file, text: current(file) }))
  assert.deepEqual(keysWithoutReader(READ_SETTING_KEYS, files), [])
})

test("a key read only by its store and schema counts as unread", () => {
  const files = [
    { path: "apps/api/src/account/store.ts", text: "notifyEmail" },
    { path: "apps/api/src/db/auth-schema.ts", text: "notifyEmail" },
    { path: "apps/web/src/features/settings/x.tsx", text: "notifyEmail" },
    { path: "apps/api/src/coach/context.ts", text: "memoryEnabled" },
  ]
  assert.deepEqual(keysWithoutReader(["notifyEmail", "memoryEnabled"], files), [
    "notifyEmail",
  ])
})
