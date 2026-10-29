import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { RISK_LABELS, TEMPLATE_FIELDS } from "./fields.mjs"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

// task.yml is a flat list of `- type:` blocks; this reads the few keys the fields share.
function parseForm(text) {
  const items = []
  for (const line of text.split("\n")) {
    const type = line.match(/^ {2}- type: (\w+)$/)
    if (type) {
      items.push({ kind: type[1], options: [] })
      continue
    }
    const item = items.at(-1)
    if (!item) continue
    const id = line.match(/^ {4}id: (\S+)$/)
    if (id) item.id = id[1]
    const label = line.match(/^ {6}label: (.+)$/)
    if (label) item.label = label[1]
    const option = line.match(/^ {8}- (\S+)$/)
    if (option) item.options.push(option[1])
    const required = line.match(/^ {6}required: (true|false)$/)
    if (required) item.required = required[1] === "true"
  }
  return items
}

test("the issue form and TEMPLATE_FIELDS list the same fields in the same order", () => {
  const form = parseForm(read(".github/ISSUE_TEMPLATE/task.yml"))
  assert.deepEqual(
    form.map(({ id, label, kind, required }) => ({
      id,
      label,
      kind,
      required,
    })),
    TEMPLATE_FIELDS.map(({ id, label, kind, required, requiredForRisk }) => ({
      id,
      label,
      kind,
      // the form cannot say "required when risk is high", so it marks those optional
      required: requiredForRisk ? false : required,
    }))
  )
})

test("dropdown options match the form", () => {
  const form = parseForm(read(".github/ISSUE_TEMPLATE/task.yml"))
  for (const field of TEMPLATE_FIELDS.filter((f) => f.kind === "dropdown"))
    assert.deepEqual(
      form.find((f) => f.id === field.id).options,
      field.options,
      field.id
    )
})

test("the form keeps the type title prefix", () => {
  assert.match(read(".github/ISSUE_TEMPLATE/task.yml"), /^title: "type: "$/m)
})

test("labels.yml declares the three risk labels", () => {
  const labels = read(".github/labels.yml")
  for (const label of RISK_LABELS)
    assert.ok(labels.includes(`name: "${label}"`), label)
})

test("every field has a flag that no other field shares", () => {
  const flags = TEMPLATE_FIELDS.map((f) => f.flag)
  assert.equal(new Set(flags).size, flags.length)
})
