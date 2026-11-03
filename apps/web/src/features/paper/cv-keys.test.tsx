import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { TextSelection } from "prosemirror-state"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { duplicateCvBlock, moveCvBlock, turnCvBlock } from "./cv-keys.ts"
import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => installEditorPolyfills())
afterEach(() => cleanup())

type Item = { id: string; type: string; children?: Item[] }

type Ready = {
  document: Item[]
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
  getTextCursorPosition: () => {
    block: { id: string; type: string; content?: unknown }
  }
  prosemirrorState: {
    selection: { $from: { parentOffset: number } }
  }
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
          id: "b0",
          type: "bullet",
          content: [],
          children: [
            {
              id: "kept",
              type: "bullet",
              content: [{ text: "Kept" }],
              children: [],
            },
          ],
        },
        {
          id: "b1",
          type: "bullet",
          content: [{ text: "Alpha" }],
          children: [
            {
              id: "mid",
              type: "bullet",
              content: [{ text: "Mid" }],
              children: [],
            },
          ],
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
    { id: "note-1", type: "paragraph", content: [{ text: "Hello" }] },
    {
      id: "sec-edu",
      type: "section",
      kind: "education",
      title: "Education",
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

it("joins and splits bullets inside an entry, and splits skills on a comma", async () => {
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
  await act(async () => {
    await Promise.resolve()
  })
  expect(document.body.textContent).toContain("School, degree")

  const skills = () =>
    ready.document.find((block) => block.type === "paperSkills")
  const firstSkill = skills()?.children?.[0]?.id
  if (!firstSkill) throw new Error("missing skill")
  place(ready, "b0", 0)
  press("Backspace")
  let job = client.document()?.blocks.find((block) => block.id === "job-1")
  let children = job && "children" in job ? job.children : []
  expect(JSON.stringify(children)).toContain("Kept")
  expect(children.some((child) => child.id === "b0")).toBe(false)
  place(ready, "kept", 0)
  press("Backspace")
  expect(JSON.stringify(client.document())).toContain("Kept")
  expect(document.activeElement?.getAttribute("data-cv-field")).toBeTruthy()
  place(ready, firstSkill, 4)
  press(",")
  let text = JSON.stringify(client.document())
  expect(text).toContain("Type")
  expect(text).toContain("Script")
  expect(text).not.toContain("Type,")
  const cursor = ready.getTextCursorPosition().block
  expect(cursor.type).toBe("paperSkillItem")
  expect(JSON.stringify(cursor.content)).toContain("Script")
  const secondSkill = skills()?.children?.[1]?.id
  if (!secondSkill) throw new Error("missing split")
  place(ready, secondSkill, 0)
  press("Backspace")
  text = JSON.stringify(client.document())
  expect(text).toContain("TypeScript")
  place(ready, "b2", 0)
  press("Backspace")
  job = client.document()?.blocks.find((block) => block.id === "job-1")
  children = job && "children" in job ? job.children : []
  const flat = JSON.stringify(children)
  expect(flat).toContain("MidBeta")
  expect(flat).not.toContain("AlphaBeta")
  expect(ready.prosemirrorState.selection.$from.parentOffset).toBe("Mid".length)
  place(ready, "b1", 5)
  press("Enter")
  const split = client.document()?.blocks.find((block) => block.id === "job-1")
  const bullets = split && "children" in split ? split.children : []
  expect(bullets.length).toBeGreaterThan(1)
  place(ready, firstSkill, 0)
  duplicateCvBlock(ready, "job-1")
  const experiences =
    client.document()?.blocks.filter((block) => block.type === "experience") ??
    []
  expect(experiences).toHaveLength(2)
  expect(
    client.document()?.blocks.filter((block) => block.type === "skills")
  ).toHaveLength(1)
  place(ready, "sec-exp", 0)
  press("/")
  expect(document.querySelector("[role='option']")).toBeNull()
  const side = (
    ready as unknown as {
      getExtension: (name: string) => {
        menuFrozen: boolean
        freezeMenu: () => void
      }
    }
  ).getExtension("sideMenu")
  side.freezeMenu()
  expect(side.menuFrozen).toBe(true)
  fireEvent.keyDown(document, { key: "Escape" })
  expect(side.menuFrozen).toBe(false)
  side.freezeMenu()
  fireEvent.pointerDown(document.body)
  expect(side.menuFrozen).toBe(false)
  const grip = document.createElement("div")
  grip.setAttribute("aria-label", "Drag block")
  document.body.append(grip)
  side.freezeMenu()
  fireEvent.dragStart(grip)
  fireEvent.pointerUp(document.body)
  await act(async () => {
    await Promise.resolve()
  })
  expect(side.menuFrozen).toBe(false)
  grip.remove()
  moveCvBlock(ready, "sec-skills", "up")
  const moved = ready.document[1] as {
    type?: string
    props?: { kind?: string }
  }
  expect(moved?.type).toBe("paperSection")
  expect(moved?.props?.kind).toBe("skills")
  duplicateCvBlock(ready, "sec-skills")
  const sectionKinds = ready.document
    .filter((block) => block.type === "paperSection")
    .map((block) => (block as { props?: { kind?: string } }).props?.kind)
  expect(sectionKinds.filter((kind) => kind === "skills")).toHaveLength(2)
  expect(
    ready.document.filter((block) => block.type === "paperSkills")
  ).toHaveLength(2)
  expect(turnCvBlock(ready, "job-1", { type: "paragraph" })).toBe(false)
  expect(turnCvBlock(ready, "note-1", { type: "paperExperience" })).toBe(true)
  const note = client.document()?.blocks.find((block) => block.id === "note-1")
  expect(note && "role" in note ? note.role : "").toBe("Hello")
})
