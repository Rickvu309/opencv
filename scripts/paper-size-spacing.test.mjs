import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectSizeSpacing } from "./lib/paper-size-spacing.mjs"

const fixtures = [
  {
    path: "apps/web/src/features/paper/rich-text-font-group.tsx",
    name: "mixed runs",
    expected: "own size",
    introduced: "cc5cd029",
    mistake: "const value = Number(draft ?? formatting?.size ?? 11)",
    clean: "editor.stepTextSize(delta)",
  },
  {
    path: "apps/web/src/features/paper/rich-text-font-group.tsx",
    name: "IME Enter",
    expected: "composition",
    introduced: "cc5cd029",
    mistake: "<Input onKeyDown={enter} />",
    clean: "<Input onKeyDown={event.nativeEvent.isComposing} />",
  },
  {
    path: "apps/web/src/features/paper/rich-text-font-group.tsx",
    name: "More dismissal",
    expected: "More popover",
    introduced: "cc5cd029",
    mistake: "editor.focus()",
    clean: "editor.focus(); onAction()",
  },
  {
    path: "apps/web/src/features/paper/rich-text-font-group.tsx",
    name: "decimal commas",
    expected: "decimal commas",
    introduced: "cc5cd029",
    mistake: '<Input type="number" />',
    clean: '<Input type="text" inputMode="decimal" />',
  },
  {
    path: "apps/web/src/features/paper/rich-text-custom-spacing.tsx",
    introduced: "ae962071",
    mistake: '<Input type="number" />',
    clean: '<Input type="text" inputMode="decimal" />',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-render-values.ts",
    introduced: "cc5cd029",
    mistake: "return `line-height:max(${minimum}pt,1.2em)`",
    clean:
      "return `line-height:max(${minimum}pt,${naturalLineHeight(font)}em)`",
  },
  {
    path: "packages/domain/src/paper-doc/presentation-values.ts",
    introduced: "4ae9a891",
    mistake: "value: z.number().min(0.5).max(10)",
    clean: "value: z.number().min(0.5).max(10).refine(exactWordUnits)",
  },
]

test("Paper size and spacing guards reject historical mistakes and accept current sources", async (t) => {
  for (const fixture of fixtures)
    await t.test(
      `size and spacing guard: ${fixture.name ?? fixture.path}`,
      () => {
        const fires = (source) =>
          detectSizeSpacing(source, fixture.path).some(
            (hit) => !fixture.expected || hit.includes(fixture.expected)
          )
        assert.ok(fires(fixture.mistake))
        assert.deepEqual(detectSizeSpacing(fixture.clean, fixture.path), [])
        for (const revision of [fixture.introduced, "29dd4410"])
          assert.ok(
            fires(
              execFileSync("git", ["show", `${revision}:${fixture.path}`], {
                encoding: "utf8",
              })
            ),
            revision
          )
        assert.deepEqual(
          detectSizeSpacing(
            readFileSync(
              new URL(`../${fixture.path}`, import.meta.url),
              "utf8"
            ),
            fixture.path
          ),
          []
        )
      }
    )
})
