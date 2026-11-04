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

it("moves across entry fields and keeps a single pasted line", async () => {
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
})
