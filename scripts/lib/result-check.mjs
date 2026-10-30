// result-check.mjs: validate a workflow result.json (schema 1). Used by the scripts/test-*.sh tests.
// Usage: node scripts/lib/result-check.mjs <file> [key=value ...]
//   key=value asserts the field equals the value (strings, numbers, or the word null).
// Prints the file's one-line summary and exits 0 when valid, prints the problems to stderr and exits 1 otherwise.
import { readFileSync } from "node:fs"
import { SCHEMA } from "../ocv-tools/result.mjs"

const SCRIPTS = SCHEMA.scripts
const STATUS = SCHEMA.status
const CAUSES = SCHEMA.causes
const FIELDS = SCHEMA.fields

const [file, ...expects] = process.argv.slice(2)
const problems = []
let r = {}
try {
  r = JSON.parse(readFileSync(file, "utf8"))
} catch (e) {
  problems.push(`not valid JSON: ${e.message}`)
}
const isStrings = (v) =>
  Array.isArray(v) && v.every((x) => typeof x === "string")
const nullableString = (v) => v === null || typeof v === "string"

for (const k of FIELDS) if (!(k in r)) problems.push(`missing field ${k}`)
for (const k of Object.keys(r))
  if (!FIELDS.includes(k)) problems.push(`unknown field ${k}`)
if (r.schema !== 1) problems.push("schema must be 1")
if (!SCRIPTS.includes(r.script)) problems.push(`bad script ${r.script}`)
if (!STATUS.includes(r.status)) problems.push(`bad status ${r.status}`)
if (!CAUSES.includes(r.cause)) problems.push(`bad cause ${r.cause}`)
if (r.status === "ok" && r.cause !== "none")
  problems.push("status ok needs cause none")
if (!["ok", "pending"].includes(r.status) && r.cause === "none")
  problems.push(`status ${r.status} needs a cause`)
for (const k of ["repo", "id", "detail", "next", "log"])
  if (!nullableString(r[k])) problems.push(`${k} must be a string or null`)
if (!isStrings(r.files)) problems.push("files must be an array of strings")
if (!isStrings(r.retried)) problems.push("retried must be an array of strings")
if (r.blockedBy !== null) {
  const b = r.blockedBy ?? {}
  if (!(b.pr === null || Number.isInteger(b.pr)))
    problems.push("blockedBy.pr must be a number or null")
  if (typeof b.commit !== "string")
    problems.push("blockedBy.commit must be a string")
  if (!isStrings(b.files))
    problems.push("blockedBy.files must be an array of strings")
}
if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(r.startedAt ?? ""))
  problems.push("startedAt must be ISO-8601 UTC")
if (!Number.isInteger(r.durSec) || r.durSec < 0)
  problems.push("durSec must be a non-negative integer")

for (const e of expects) {
  const i = e.indexOf("=")
  const key = e.slice(0, i)
  const want = e.slice(i + 1)
  const got = r[key]
  const text =
    got === null
      ? "null"
      : typeof got === "object"
        ? JSON.stringify(got)
        : String(got)
  if (text !== want) problems.push(`${key}: got ${text}, want ${want}`)
}

if (problems.length) {
  console.error(`${file}: ${problems.join("; ")}`)
  process.exit(1)
}
console.log(`${r.script} ${r.id} ${r.status}/${r.cause}`)
