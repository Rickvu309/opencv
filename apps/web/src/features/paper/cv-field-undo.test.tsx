import { StrictMode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { structuredCv } from "@/test/paper-structured-cv.ts"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => installEditorPolyfills())
afterEach(() => cleanup())

it("undoes with ctrl+z and cmd+z, and tabs from the header to the first ghost", async () => {
  const client = seededCvClient(structuredCv())
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
  let role = screen.getByRole("textbox", { name: "Role" })
  expect(document.activeElement).toBe(role)
  fireEvent.input(role, { target: { value: "Engineer" } })
  role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.keyDown(role, { key: "z", ctrlKey: true })
  expect(JSON.stringify(client.document())).not.toContain("Engineer")
  role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.input(role, { target: { value: "Engineer" } })
  role = screen.getByRole("textbox", { name: "Role" })
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
