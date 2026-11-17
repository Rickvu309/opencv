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

it("tabs out of contact and opens a bullet from the last entry field", async () => {
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
