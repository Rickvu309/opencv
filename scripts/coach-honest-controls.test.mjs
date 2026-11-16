import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  COACH_HONEST_CONTROL_FILES,
  detect,
} from "./lib/coach-honest-controls.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60_000,
  })

const SETTINGS_INTRODUCED = "506377b7d0f1744f14c1ee89f26126325152b85e"
const CONTEXT_INTRODUCED = "2c62f760d46d87251b7b5b2ed61217ed5d154fa4"
const LIMIT_INTRODUCED = "2218357d1f6a25f693d0b933fe4e9b1aad219d1e"
const UNDONE_INTRODUCED = "47367e71fa6ac307e6b6cf23e12d55341789a028"
const SWITCH_TARGET_INTRODUCED = "e803472ce13d38d1f154eaf6e0629c14611e5350"
const APPROVAL_CAPTURE_INTRODUCED = "ae31f30cce57990a8e2172d5a0174e890ae25f73"

test("a circular mobile track and an unscoped approval capture fire", () => {
  const found = detect(`
    max-md:[&_[data-slot=switch-thumb]]:data-checked:translate-x-[26px]!
    { click: { role: "button", name: "Approve" } }
  `).join("\n")
  assert.match(found, /mobile switch paints its whole tap area/)
  assert.match(found, /Coach approval capture can hit/)
})

test("a separate mobile track and panel-scoped approval stay quiet", () => {
  assert.deepEqual(
    detect(`
    max-md:before:h-[18px] max-md:before:w-8
    { click: { selector: 'coach-panel button:text-is("Approve")' } }
  `),
    []
  )
})

test("the commits introducing the mobile switch and approval capture mistakes fire", () => {
  const cases = [
    [
      SWITCH_TARGET_INTRODUCED,
      "apps/web/src/features/settings/coach-section.tsx",
      /mobile switch paints its whole tap area/,
    ],
    [
      APPROVAL_CAPTURE_INTRODUCED,
      "scripts/ui/screens.mjs",
      /Coach approval capture can hit/,
    ],
  ]
  for (const [sha, file, message] of cases) {
    assert.match(detect(git("show", `${sha}:${file}`)).join("\n"), message)
    const parentPath = git("ls-tree", `${sha}^`, "--", file).trim()
    if (parentPath)
      assert.doesNotMatch(
        detect(git("show", `${sha}^:${file}`)).join("\n"),
        message
      )
  }
})

test("a bare undone record and an unfocused starter fire", () => {
  const found = detect(`
    if (part.undone) {
      return <p className="text-xs">Undone</p>
    }
    setDraft(starter)
  `).join("\n")
  assert.match(found, /undone record loses its artifact/)
  assert.match(found, /starter leaves focus behind/)
})

test("a retained document record and a focused starter stay quiet", () => {
  assert.deepEqual(
    detect(`
      <DocumentActionRecord view={view} />
      onChooseStarter={chooseStarter}
      field.focus()
      field.setSelectionRange(field.value.length, field.value.length)
    `),
    []
  )
})

test("the commit introducing the bare undone return fires and its parent stays quiet", () => {
  const file = "apps/web/src/features/coach/coach-tool-line.tsx"
  assert.match(
    detect(git("show", `${UNDONE_INTRODUCED}:${file}`)).join("\n"),
    /undone record loses its artifact/
  )
  assert.doesNotMatch(
    detect(git("show", `${UNDONE_INTRODUCED}^:${file}`)).join("\n"),
    /undone record loses its artifact/
  )
})

test("the commit introducing an unfocused starter fires", () => {
  assert.match(
    detect(
      git(
        "show",
        `${CONTEXT_INTRODUCED}:apps/web/src/features/coach/coach-workspace.tsx`
      )
    ).join("\n"),
    /starter leaves focus behind/
  )
})

const ROW_TOGGLE = `
  <SettingsRow
    onClick={() =>
      onSave({ [agent.key]: !profile[agent.key] } as ProfilePatch)
    }
    control={<StateWord on={profile[agent.key]} chevron />}
  />
`

const SWITCH_TOGGLE = `
  <Switch
    checked={profile[agent.key]}
    onCheckedChange={(on) => onSave({ [agent.key]: on })}
  />
`

test("a capability toggle saved by a row click fires", () => {
  assert.match(
    detect(ROW_TOGGLE).join("\n"),
    /toggle presented as a row button/
  )
})

test("a capability Switch with checked state stays quiet", () => {
  assert.deepEqual(detect(SWITCH_TOGGLE), [])
})

test("silent truncation, host-only labels and next-message scope fire", () => {
  const found = detect(`
    attachments: [...attachments, item].slice(0, 8),
    item: { kind: "link", id: url.href, label: url.hostname },
    "Choose context for your next message."
  `).join("\n")
  assert.match(found, /silent context truncation/)
  assert.match(found, /host-only link label/)
  assert.match(found, /next-message context scope/)
})

test("a refused item, a path label and per-message scope stay quiet", () => {
  assert.deepEqual(
    detect(`
      attachments.length >= ATTACHMENT_LIMIT ? attachments : [...attachments, item],
      item: { kind: "link", id: url.href, label: linkAttachmentLabel(url) },
      "What you add is included with each message until you remove it."
    `),
    []
  )
})

test("the Coach settings where row toggles were introduced fires", () => {
  const past = git(
    "show",
    `${SETTINGS_INTRODUCED}:apps/web/src/features/settings/coach-section.tsx`
  )
  assert.match(detect(past).join("\n"), /toggle presented as a row button/)
})

test("the Coach workspace where host labels and next-message scope were introduced fires", () => {
  const past = detect(
    git(
      "show",
      `${CONTEXT_INTRODUCED}:apps/web/src/features/coach/coach-workspace.tsx`
    )
  ).join("\n")
  assert.match(past, /host-only link label/)
  assert.match(past, /next-message context scope/)
  assert.match(past, /silent context truncation/)
})

test("the reducer where silent truncation moved fires", () => {
  const past = git(
    "show",
    `${LIMIT_INTRODUCED}:apps/web/src/features/coach/coach-workspace.reducer.ts`
  )
  assert.match(detect(past).join("\n"), /silent context truncation/)
})

test("the owning Coach control files stay quiet", () => {
  for (const file of COACH_HONEST_CONTROL_FILES)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      []
    )
})
