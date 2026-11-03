import { StrictMode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { blankCv } from "@workspace/domain"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => installEditorPolyfills())
afterEach(() => cleanup())

function jobDocument() {
  const base = blankCv()
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

  fireEvent.keyDown(role, { key: "Enter" })
  const company = screen.getByRole("textbox", { name: "Company" })
  expect(document.activeElement).toBe(company)
  fireEvent.keyDown(company, { key: "Backspace" })
  expect(document.activeElement).toBe(role)

  fireEvent.keyDown(role, { key: "ArrowRight" })
  expect(document.activeElement).toBe(company)
  fireEvent.paste(company, {
    clipboardData: { getData: () => "One\nTwo" },
  })
  const text = JSON.stringify(client.document())
  expect(text).toContain("One")
  expect(text).not.toContain("Two")

  const dates = screen.getByRole("textbox", { name: "Dates" })
  dates.focus()
  fireEvent.keyDown(dates, { key: "Enter" })
  const location = screen.getByRole("textbox", { name: "Location" })
  expect(document.activeElement).toBe(location)
  fireEvent.keyDown(location, { key: "Enter" })
  const job = client.document()?.blocks.find((block) => block.id === "job-1")
  expect(job && "children" in job ? job.children : []).toHaveLength(1)
  const linkedin = screen.getByRole("textbox", { name: "LinkedIn" })
  linkedin.focus()
  fireEvent.keyDown(linkedin, { key: "Tab" })
  expect(document.activeElement).not.toBe(linkedin)
  fireEvent.keyDown(linkedin, { key: "Enter" })
  expect(document.activeElement).not.toBe(linkedin)
})

it("undoes with ctrl+z and cmd+z, and tabs from the header to the first ghost", async () => {
  const client = seededCvClient(blankCv())
  let editor: {
    document: { id: string; type: string }[]
    insertBlocks: (
      blocks: unknown[],
      ref: string,
      placement: "after"
    ) => { id: string }[]
    undo: () => void
  } | null = null
  act(() => {
    render(
      <StrictMode>
        <PaperEditorEngine
          kind="cv"
          client={client}
          generation={1}
          label="CV"
          onDocument={() => undefined}
          onSelectedBlocks={() => undefined}
          onReady={(value) => {
            editor = value as NonNullable<typeof editor>
          }}
        />
      </StrictMode>
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  const linkedin = screen.getByRole("textbox", { name: "LinkedIn" })
  linkedin.focus()
  fireEvent.keyDown(linkedin, { key: "Tab" })
  const ghost = screen.getByRole("button", { name: "Role, company" })
  expect(document.activeElement).toBe(ghost)
  fireEvent.click(ghost)
  const role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.input(role, { target: { value: "Engineer" } })
  fireEvent.keyDown(role, { key: "z", ctrlKey: true })
  expect(JSON.stringify(client.document())).not.toContain("Engineer")
  fireEvent.input(role, { target: { value: "Engineer" } })
  fireEvent.keyDown(role, { key: "z", metaKey: true })
  expect(JSON.stringify(client.document())).not.toContain("Engineer")
  if (!editor) throw new Error("missing editor")
  const anchor = editor.document[editor.document.length - 1]
  if (!anchor) throw new Error("missing anchor")
  act(() => {
    editor?.insertBlocks(
      [{ type: "paragraph", content: "Q" }],
      anchor.id,
      "after"
    )
  })
  expect(JSON.stringify(editor.document)).toContain("Q")
  act(() => editor?.undo())
  expect(JSON.stringify(editor.document)).not.toContain("Q")
})
