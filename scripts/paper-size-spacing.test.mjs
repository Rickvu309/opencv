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
    path: "packages/paper-crdt/src/native-layout-formatting.ts",
    introduced: "54fbdb62",
    mistake: "engineProps(paragraphSchema.parse(input))",
    clean: "engineProps(paragraphEditSchema.parse(input))",
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

test("Paper legacy spacing guards separate compatible reads, rounded exports and run-based struts", async (t) => {
  for (const fixture of [
    {
      path: "packages/domain/src/paper-doc/presentation-values.ts",
      expected: "backwards compatible",
      introduced: "fc53c911",
      mistake:
        "const lineSpacingSchema = value.refine(exactWordUnits); export function lineSpacingWordUnits",
      clean:
        "const lineSpacingSchema = value; export function lineSpacingWordUnits",
    },
    {
      path: "packages/domain/src/paper-doc/presentation-values.ts",
      expected: "round at the Word boundary",
      introduced: "fc53c911",
      mistake: "const units = exactWordUnits(line.value * 240)",
      clean: "const units = Math.round(line.value * 240)",
    },
    {
      path: "packages/paper-crdt/src/native-formatting-decorations.ts",
      expected: "actual runs",
      introduced: "fc53c911",
      mistake:
        "paragraphCss(paragraph, effectiveInline(presentation, {}, style))",
      clean: "paragraphCss(paragraph, paragraphStrut(node, presentation))",
    },
  ])
    await t.test(fixture.expected, () => {
      const fires = (text) =>
        detectSizeSpacing(text, fixture.path).some((hit) =>
          hit.includes(fixture.expected)
        )
      assert.ok(fires(fixture.mistake))
      assert.deepEqual(detectSizeSpacing(fixture.clean, fixture.path), [])
      assert.ok(
        fires(
          execFileSync(
            "git",
            ["show", `${fixture.introduced}:${fixture.path}`],
            { encoding: "utf8" }
          )
        )
      )
      assert.deepEqual(
        detectSizeSpacing(
          readFileSync(new URL(`../${fixture.path}`, import.meta.url), "utf8"),
          fixture.path
        ),
        []
      )
    })
})
