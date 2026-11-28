import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { detect } from "./lib/test-shared-global-restore.mjs"

const root = path.resolve(import.meta.dirname, "..")

const DELETED_ATOM = `function signIn(ownerId) {
  authClient.$store.atoms.session = { get: () => ({ data: { user: { id: ownerId } } }) }
}
afterEach(() => {
  delete authClient.$store.atoms.session
})
`

const RESTORED_ATOM = `const realSessionAtom = authClient.$store.atoms.session

function signIn(ownerId) {
  authClient.$store.atoms.session = { get: () => ({ data: { user: { id: ownerId } } }) }
}
afterEach(() => {
  authClient.$store.atoms.session = realSessionAtom
})
`

const MODULE_SCOPE_PROTOTYPE = `if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}
`

const HOOKED_PROTOTYPE = `const motionApis = Element.prototype
const hadGetAnimations = typeof motionApis.getAnimations === "function"
beforeAll(() => {
  if (!hadGetAnimations) motionApis.getAnimations = () => []
})
afterAll(() => {
  if (!hadGetAnimations) Reflect.deleteProperty(motionApis, "getAnimations")
})
it("slides", () => {
  Element.prototype.animate = () => ({})
})
`

const FILE = "apps/web/src/lib/a.test.ts"

test("a deleted or never restored auth store atom fires", () => {
  assert.deepEqual(
    detect(DELETED_ATOM, FILE).map((line) => line.split(";")[0]),
    [
      `${FILE}: deletes the auth store atom session`,
      `${FILE}: replaces the auth store atom session without saving the live atom and putting it back`,
    ]
  )
})

test("a module scope prototype write fires", () => {
  assert.deepEqual(
    detect(MODULE_SCOPE_PROTOTYPE, "apps/web/src/lib/a.test.tsx").map(
      (line) => line.split(" at module scope")[0]
    ),
    ["apps/web/src/lib/a.test.tsx: writes Element.prototype.getAnimations"]
  )
})

test("a saved atom, hooked prototype stubs and isolated files stay quiet", () => {
  assert.deepEqual(detect(RESTORED_ATOM, FILE), [])
  assert.deepEqual(detect(HOOKED_PROTOTYPE, "apps/web/src/lib/b.test.tsx"), [])
  assert.deepEqual(
    detect(DELETED_ATOM, "apps/web/src/lib/a.isolated.test.ts"),
    []
  )
  assert.deepEqual(
    detect(MODULE_SCOPE_PROTOTYPE, "apps/web/src/lib/a.isolated.test.tsx"),
    []
  )
})

test("every tracked shared web test puts back the globals it replaces", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "apps/web/src/**/*.test.ts", "apps/web/src/**/*.test.tsx"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter(Boolean)
  const problems = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
