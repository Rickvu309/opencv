import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { TextSelection } from "prosemirror-state"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => installEditorPolyfills())
afterEach(() => cleanup())

type Item = { id: string; type: string; children?: Item[] }

type Ready = {
  document: Item[]
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
  transact: (
    fn: (tr: {
      selection: { from: number }
      doc: Parameters<typeof TextSelection.create>[0]
      setSelection: (
        selection: ReturnType<typeof TextSelection.create>
      ) => unknown
    }) => void
  ) => void
}

const cv = {
  version: 3,
  kind: "cv",
  header: {
    id: "header",
    type: "header",
    name: "Ada",
    email: "",
    phone: "",
    city: "",
    linkedin: "",
  },
  blocks: [
    {
      id: "sec-exp",
      type: "section",
      kind: "experience",
      title: "Experience",
    },
    {
      id: "job-1",
      type: "experience",
      role: "Eng",
      company: "Acme",
      period: "2020",
      location: "",
      children: [
        {
          id: "b1",
          type: "bullet",
          content: [{ text: "Alpha" }],
          children: [],
        },
        { id: "b2", type: "bullet", content: [{ text: "Beta" }], children: [] },
      ],
    },
    { id: "sec-skills", type: "section", kind: "skills", title: "Skills" },
    {
      id: "skills-1",
      type: "skills",
      label: "Tools",
      items: ["TypeScript", "React"],
    },
  ],
  clashes: [],
}

function place(editor: Ready, id: string, offset: number) {
  act(() => {
    editor.setTextCursorPosition(id, "start")
  })
  act(() => {
    editor.transact((tr) => {
      tr.setSelection(TextSelection.create(tr.doc, tr.selection.from + offset))
    })
  })
}

function press(key: string) {
  const view = document.querySelector(".bn-editor")
  if (!view) throw new Error("missing editor")
  fireEvent.keyDown(view, { key })
}

it("joins and splits bullets inside an entry, and splits skills on a comma", () => {
  const client = seededCvClient(cv)
  let editor: Ready | null = null
  act(() => {
    render(
      <PaperEditorEngine
        kind="cv"
        client={client}
        generation={1}
        label="CV"
        onDocument={() => undefined}
        onSelectedBlocks={() => undefined}
        onReady={(value) => {
          editor = value as unknown as Ready
        }}
      />
    )
  })
  if (!editor) throw new Error("missing editor")
  const ready = editor as Ready
  const skills = () =>
    ready.document.find((block) => block.type === "paperSkills")
  const firstSkill = skills()?.children?.[0]?.id
  if (!firstSkill) throw new Error("missing skill")
  place(ready, firstSkill, 4)
  press(",")
  let text = JSON.stringify(client.document())
  expect(text).toContain("Type")
  expect(text).toContain("Script")
  expect(text).not.toContain("Type,")
  const secondSkill = skills()?.children?.[1]?.id
  if (!secondSkill) throw new Error("missing split")
  place(ready, secondSkill, 0)
  press("Backspace")
  text = JSON.stringify(client.document())
  expect(text).toContain("TypeScript")
  place(ready, "b2", 0)
  press("Backspace")
  const job = client.document()?.blocks.find((block) => block.id === "job-1")
  const children = job && "children" in job ? job.children : []
  expect(children).toHaveLength(1)
  expect(JSON.stringify(children[0])).toContain("Alpha")
  expect(JSON.stringify(children[0])).toContain("Beta")
  place(ready, "b1", 5)
  press("Enter")
  const split = client.document()?.blocks.find((block) => block.id === "job-1")
  const bullets = split && "children" in split ? split.children : []
  expect(bullets.length).toBeGreaterThan(1)
})
