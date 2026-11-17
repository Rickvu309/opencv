import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectCoachSelection } from "./lib/paper-coach-selection.mjs"

const fixtures = [
  {
    path: "apps/api/src/paper/content-coach.ts",
    mistake:
      "if (writer?.supportedSchemaRevisions.includes(2)) return revertRichCoachEdit(writer)",
    clean: 'if (identity.format === "rich") return revertRichCoachEdit(writer)',
  },
  {
    path: "apps/api/src/coach/context.ts",
    mistake: "paperFocus(input.registry, input.actor, paperId)",
    clean: "paperFocus(input.registry, input.actor, paperId, blockIds)",
  },
  {
    path: "apps/api/src/coach/task-runtime.ts",
    mistake: "fakePaperIntent(focus)",
    clean: "fakePaperIntent(focus, blockIds)",
  },
  {
    path: "apps/api/src/coach/fake.ts",
    mistake:
      'richRows.find(node => node.selected) ?? richRows.find(node => node.type === "paragraph")',
    clean:
      'selected.length ? selected.map(id => richRows.find(node => node.id === id)) : richRows.filter(node => node.type === "paragraph")',
  },
]

test("Coach selection and Undo guards reject mistake fixtures and preserve clean fixtures", () => {
  for (const fixture of fixtures) {
    assert.equal(
      detectCoachSelection(fixture.mistake, fixture.path).length,
      1,
      fixture.path
    )
    assert.deepEqual(
      detectCoachSelection(fixture.clean, fixture.path),
      [],
      fixture.path
    )
  }
})

test("Coach selection and Undo guards reject the introducing head and accept the fixes", () => {
  const root = new URL("../", import.meta.url)
  for (const fixture of fixtures) {
    const old = execFileSync(
      "git",
      ["show", `00fb77fe412b476d337d3c317e3fc04a6fa02d1e:${fixture.path}`],
      { cwd: root, encoding: "utf8" }
    )
    assert.equal(
      detectCoachSelection(old, fixture.path).length,
      1,
      fixture.path
    )
    assert.deepEqual(
      detectCoachSelection(
        readFileSync(new URL(fixture.path, root), "utf8"),
        fixture.path
      ),
      [],
      fixture.path
    )
  }
})
