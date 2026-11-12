import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detectOpenInput } from "./lib/paper-page-input.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const PAGE = path.join(root, "apps/web/src/features/paper-page")

const openHandlerAt31a101b1 = `
function Sheet() {
  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const onBefore = (event: Event) => {
      if (composing.current) return
      const input = event as InputEvent
      if (typeof input.inputType !== "string") return
      if (
        input.inputType === "insertCompositionText" ||
        input.inputType === "insertParagraph"
      ) {
        return
      }
      if (input.inputType === "insertText") {
        event.preventDefault()
        dispatch({ type: "insert", text: input.data ?? "" })
        return
      }
      if (input.inputType === "deleteContentBackward") {
        event.preventDefault()
        dispatch({ type: "backward" })
      }
    }
    page.addEventListener("beforeinput", onBefore)
    return () => page.removeEventListener("beforeinput", onBefore)
  }, [])
}
`

const ruledHandler = `
function Sheet() {
  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const onBefore = (event: Event) => {
      if (composing.current) return
      const input = event as InputEvent
      if (typeof input.inputType !== "string") return
      const rule = inputRule(input.inputType)
      if (rule.kind === "native") return
      event.preventDefault()
      if (rule.kind === "blocked") return
      dispatch({ type: "edit", edit: rule.edit })
    }
    page.addEventListener("beforeinput", onBefore)
    return () => page.removeEventListener("beforeinput", onBefore)
  }, [])
}
`

const inlineOpenHandler = `
const view = <article onBeforeInput={(event) => {
  switch (event.nativeEvent.inputType) {
    case "insertText":
      event.preventDefault()
  }
}} />
`

test("MISTAKE: the writing page's first input handler, which let formatBold and every unnamed input through, fires", () => {
  assert.deepEqual(
    detectOpenInput(openHandlerAt31a101b1, "canvas.tsx").map(
      ({ kind, line }) => ({ kind, line })
    ),
    [
      { kind: "beforeinput-without-input-rule", line: 6 },
      { kind: "input-type-picked-by-hand", line: 11 },
      { kind: "input-type-picked-by-hand", line: 12 },
      { kind: "input-type-picked-by-hand", line: 16 },
      { kind: "input-type-picked-by-hand", line: 21 },
    ]
  )
})

test("MISTAKE: an inline handler that switches on the input type by hand fires", () => {
  assert.deepEqual(
    detectOpenInput(inlineOpenHandler, "inline.tsx").map(({ kind }) => kind),
    ["beforeinput-without-input-rule", "input-type-picked-by-hand"]
  )
})

test("a handler that asks the shared input rule and blocks the rest stays quiet", () => {
  assert.deepEqual(detectOpenInput(ruledHandler, "canvas.tsx"), [])
})

test("a file with no input handler stays quiet", () => {
  assert.deepEqual(
    detectOpenInput(`const a = event.inputType === "insertText"`, "a.ts"),
    []
  )
})

test("every input handler on the writing page asks the shared input rule", () => {
  const sources = readdirSync(PAGE).filter(
    (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
  )
  assert.ok(sources.includes("canvas.tsx"))
  for (const name of sources) {
    const text = readFileSync(path.join(PAGE, name), "utf8")
    assert.deepEqual(detectOpenInput(text, name), [], name)
  }
})
