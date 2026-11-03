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
  fireEvent.keyDown(role, { key: "z", metaKey: true })
  expect(JSON.stringify(client.document())).not.toContain("Engineer")

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
})
