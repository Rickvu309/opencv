import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { detect } from "./lib/paper-print-readiness.mjs"

const schedule = ["set", "Timeout"].join("")
const mistake = `export function printPaper() {
  const images = [...document.body.querySelectorAll("[data-paper-print] img")]
  const fonts = document.fonts.ready
  const decoded = Promise.all(images.map(img => img.decode().catch(() => undefined)))
  const bound = new Promise(resolve => { window.${schedule}(resolve, 2000) })
  void Promise.race([Promise.all([fonts, decoded]), bound]).then(() => { window.print() })
}`
const clean = `export function printPaper() {
  const images = [...document.body.querySelectorAll("[data-paper-print] img")]
  const decoded = Promise.all(images.map(img => img.decode()))
  const deadline = new Promise((resolve, reject) => { window.${schedule}(() => reject(new Error("Readiness deadline")), 2000) })
  void Promise.race([decoded, deadline]).then(() => { window.print() }, error => refuse(error))
}`

test("detects both actual print readiness success conversions", () => {
  assert.deepEqual(detect(mistake), [
    "A resolving deadline can authorize window.print",
    "A required decode rejection becomes readiness success",
  ])
})
test("permits rejected deadlines and explicit refusal", () =>
  assert.deepEqual(detect(clean), []))
test("does not ban unrelated races or image catches", () => {
  assert.deepEqual(
    detect(
      `function unrelated(){ return Promise.race([photo.decode().catch(()=>undefined), new Promise(resolve=>${schedule}(resolve,2000))]) }`
    ),
    []
  )
  assert.deepEqual(
    detect(
      "function printPaper(){ void photo.decode().catch(()=>undefined); Promise.resolve().then(()=>window.print()) }"
    ),
    []
  )
})
test("fires against the actual introducing commit", () => {
  const repo = new URL("..", import.meta.url)
  const historic = execFileSync(
    "git",
    ["show", "5201a882:apps/web/src/features/paper/paper-print.ts"],
    { cwd: repo, encoding: "utf8" }
  )
  assert.equal(detect(historic).length, 2)
})

test("the current print boundary does not authorize readiness failures", () => {
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/paper-print.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})

test("rejects swallowed photo errors in the readiness helper", () => {
  assert.deepEqual(
    detect(
      "async function readyPhoto(image) { await image.decode().catch(() => undefined) }"
    ),
    ["A required decode rejection becomes readiness success"]
  )
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/paper-print-readiness.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
