import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  SERVED_ROUTES_FILE,
  calledApiPaths,
  detect,
} from "./lib/ui-driver-routes.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DRIVER = "scripts/ui/sweep/browser-world.mjs"
const INTRODUCED = "0065fa9d0"

const served = `
const doors = ["POST /api/commands/:name", "POST /api/reads/:name"]
const download = ["GET /api/paper/:id/native-word"]
const waiting = ["GET /api/paper/packages/:docId/read"]
`
const io = { read: (rel) => (rel === SERVED_ROUTES_FILE ? served : null) }

const mistake = `
const library = await (await api("/api/paper")).json()
`

const clean = `
const library = await (await read("paper.list", {})).json()
const post = context.request.post(\`\${state.apiOrigin}/api/reads/\${name}\`)
const text = await (await api(\`/api/paper/packages/\${docId}/read\`)).text()
const file = await api(\`/api/paper/\${docId}/native-word\`)
`

const show = (rev, rel) =>
  execFileSync("git", ["show", `${rev}:${rel}`], {
    cwd: root,
    encoding: "utf8",
  })

const atRevision = (rev) => ({ read: (rel) => show(rev, rel) })

test("a UI check that calls a route the API stopped serving fires", () => {
  assert.deepEqual(
    detect(mistake, DRIVER, io).map(({ name, line }) => [name, line]),
    [["UNSERVED_ROUTE", 2]]
  )
})

test("calls through the read door, listed downloads and waiting routes stay quiet", () => {
  assert.deepEqual(
    calledApiPaths(clean).map(({ path }) => path),
    ["/api/reads/x", "/api/paper/packages/x/read", "/api/paper/x/native-word"]
  )
  assert.deepEqual(detect(clean, DRIVER, io), [])
})

test("every UI check script calls only routes the API serves", () => {
  const dir = path.join(root, "scripts/ui")
  const files = readdirSync(dir, { recursive: true }).filter(
    (file) => file.endsWith(".mjs") && !file.endsWith(".test.mjs")
  )
  assert.ok(files.includes("sweep/browser-world.mjs"))
  for (const file of files) {
    const rel = `scripts/ui/${file}`
    assert.deepEqual(
      detect(readFileSync(path.join(root, rel), "utf8"), rel),
      [],
      rel
    )
  }
})

test("the library read fires where the list route left the API and was quiet before", () => {
  const driver = show(INTRODUCED, DRIVER)
  assert.deepEqual(
    detect(driver, DRIVER, atRevision(INTRODUCED)).map(({ message }) =>
      message.includes("calls /api/paper,")
    ),
    [true]
  )
  assert.deepEqual(detect(driver, DRIVER, atRevision(`${INTRODUCED}^`)), [])
})
