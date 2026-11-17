import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { structuredCv } from "@/test/paper-structured-cv.ts"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => installEditorPolyfills())
afterEach(() => cleanup())

function jobDocument() {
  const base = structuredCv()
  return {
    ...base,
    blocks: [
      base.blocks[0],
      {
        id: "job-1",
        type: "experience",
        role: "",
        company: "",
        period: "",
        location: "",
        children: [],
      },
      ...base.blocks.slice(1),
    ],
  }
}

it("keeps the caret field, undoes through the editor, and ignores a composition", async () => {
  const client = seededCvClient(jobDocument())
  act(() => {
    render(
      <PaperEditorEngine
        kind="cv"
        client={client}
        generation={1}
        label="CV"
        onDocument={() => undefined}
        onSelectedBlocks={() => undefined}
      />
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  const role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.input(role, { target: { value: "Engineer" } })
  expect(JSON.stringify(client.document())).toContain("Engineer")
  const undo = new InputEvent("beforeinput", {
    inputType: "historyUndo",
    bubbles: true,
    cancelable: true,
  })
  role.dispatchEvent(undo)
  expect(undo.defaultPrevented).toBe(true)
  expect(JSON.stringify(client.document())).not.toContain("Engineer")
  fireEvent.input(role, { target: { value: "Engineer" } })
  expect(JSON.stringify(client.document())).not.toContain("Engineer")
  await act(async () => {
    await Promise.resolve()
  })
  const redo = new InputEvent("beforeinput", {
    inputType: "historyRedo",
    bubbles: true,
    cancelable: true,
  })
  role.dispatchEvent(redo)
  expect(redo.defaultPrevented).toBe(true)
  expect(JSON.stringify(client.document())).toContain("Engineer")
  expect(role).toHaveAttribute("data-cv-size", "entry")
  expect(role).toHaveAttribute("size", "1")
  expect(screen.getByRole("textbox", { name: "Phone" })).toHaveAttribute(
    "data-cv-size",
    "contact"
  )

  fireEvent.compositionStart(role)
  role.value = "日"
  fireEvent.input(role)
  fireEvent.keyDown(role, { key: "Enter", keyCode: 229 })
  expect(JSON.stringify(client.document())).not.toContain("日")
  fireEvent.compositionEnd(role)
  expect(JSON.stringify(client.document())).toContain("日")
})
