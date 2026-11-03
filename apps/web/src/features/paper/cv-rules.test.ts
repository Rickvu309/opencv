import { BlockNoteEditor } from "@blocknote/core"
import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { paperSchema } from "@workspace/paper-crdt"
import { Slice, type Node } from "prosemirror-model"
import { EditorState, TextSelection } from "prosemirror-state"
import { ySyncPluginKey } from "y-prosemirror"
import { expect, it } from "vitest"

import { addedBlockType, cvFormatHidden } from "./cv-keys.ts"
import { coerceCvPaste, cvRulesPlugin } from "./cv-rules.ts"
import { cvSlashItems, filterCvSlash } from "./cv-slash.ts"

const editor = BlockNoteEditor.create({ schema: paperSchema })

const docOf = (blocks: unknown[]) =>
  _blocksToProsemirrorNode(editor, blocks as never)

const header = { id: "header", type: "paperHeader", props: { name: "Ada" } }
const section = {
  id: "s1",
  type: "paperSection",
  props: { kind: "experience" },
  content: "Experience",
}
const experience = {
  id: "e1",
  type: "paperExperience",
  props: { role: "Eng", company: "Acme", period: "", location: "" },
}
const later = {
  id: "s2",
  type: "paperSection",
  props: { kind: "education" },
  content: "Education",
}
const school = {
  id: "e2",
  type: "paperEducation",
  props: { school: "State", degree: "BS", period: "", detail: "" },
}
const item = (text: string, children: unknown[] = []) => ({
  type: "bulletListItem",
  content: text,
  children,
})

const filter = (before: unknown[], after: unknown[], meta?: boolean) =>
  cvRulesPlugin.spec.filterTransaction!(
    {
      docChanged: true,
      doc: docOf(after),
      getMeta: (key: unknown) =>
        meta && key === ySyncPluginKey ? {} : undefined,
    } as never,
    { doc: docOf(before) } as never
  )

function retag(node: Node, level: number): Node {
  if (node.type.name === "heading") {
    return node.type.create({ ...node.attrs, level }, node.content, node.marks)
  }
  if (node.childCount === 0) return node
  const kids: Node[] = []
  node.forEach((child) => kids.push(retag(child, level)))
  return node.type.create(node.attrs, kids, node.marks)
}

function textIn(slice: Slice, type: string) {
  let text = ""
  let level = 0
  slice.content.descendants((node) => {
    if (node.type.name === type) {
      text += node.textContent
      if (type === "heading") level = Number(node.attrs.level)
    }
  })
  return { text, level }
}

function ids(doc: Node) {
  const out: string[] = []
  doc.child(0).forEach((container) => {
    out.push(String(container.attrs.id))
  })
  return out
}

it("refuses a document the server repair would rewrite, coerces a paste, and moves a section with its group", () => {
  const base = [header, section, experience]
  expect(filter(base, [section, experience])).toBe(false)
  expect(filter(base, [section, header, experience])).toBe(false)
  expect(
    filter(base, [header, { ...experience, id: "e9" }, section, experience])
  ).toBe(false)
  expect(
    filter(base, [
      header,
      section,
      { type: "paragraph", content: "x", children: [item("kid")] },
    ])
  ).toBe(false)
  expect(
    filter(
      [header, section, item("a", [item("b", [item("c")])])],
      [header, section, item("a", [item("b", [item("c", [item("d")])])])]
    )
  ).toBe(false)
  expect(filter(base, [section])).toBe(false)
  expect(filter(base, [section], true)).toBe(true)

  const state = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf(base),
  })
  const heading = retag(
    docOf([{ id: "h", type: "heading", props: { level: 2 }, content: "Big" }]),
    1
  )
  const pasted = cvRulesPlugin.props.transformPasted!(
    new Slice(heading.content, 0, 0),
    { state } as never
  )
  expect(textIn(pasted, "heading")).toEqual({ text: "Big", level: 2 })
  const extra = docOf([
    { id: "hx", type: "paperHeader", props: { name: "Ada Lovelace" } },
  ])
  const coerced = coerceCvPaste(new Slice(extra.content, 0, 0))
  expect(textIn(coerced, "paragraph").text).toContain("Ada Lovelace")
  const stray = docOf([{ id: "sk", type: "paperSkillItem", content: "React" }])
  expect(
    textIn(coerceCvPaste(new Slice(stray.content, 0, 0)), "paragraph").text
  ).toContain("React")

  let moved = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([header, section, experience, later, school]),
    plugins: [cvRulesPlugin],
  })
  const nodes: { node: Node; pos: number }[] = []
  moved.doc.child(0).forEach((node, offset) => {
    nodes.push({ node, pos: offset + 1 })
  })
  const dragging = nodes[3]!
  const before = nodes[2]!
  const tr = moved.tr
    .delete(dragging.pos, dragging.pos + dragging.node.nodeSize)
    .insert(before.pos, dragging.node)
  moved = moved.apply(tr)
  expect(ids(moved.doc)).toEqual(["header", "s1", "s2", "e2", "e1"])
  let selected = ""
  moved.doc.nodesBetween(moved.selection.from, moved.selection.to, (node) => {
    if (node.type.name === "paperSection") selected = "paperSection"
  })
  expect(selected).toBe("paperSection")

  const down = relocate(
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf([header, section, experience, later, school]),
      plugins: [cvRulesPlugin],
    }),
    "e1",
    "e2"
  )
  expect(ids(down.doc)).toEqual(["header", "s1", "s2", "e1", "e2"])
  const up = relocate(
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf([header, section, experience, later, school]),
      plugins: [cvRulesPlugin],
    }),
    "e2",
    "s2"
  )
  expect(ids(up.doc)).toEqual(["header", "s1", "e1", "e2", "s2"])

  const nested = (depth: number): unknown =>
    depth <= 1 ? item("leaf") : item("nest", [nested(depth - 1)])
  const entry = (depth: number) => [
    header,
    section,
    { ...experience, children: [nested(depth)] },
  ]
  expect(filter(entry(2), entry(3))).toBe(true)
  expect(filter(entry(3), entry(4))).toBe(false)

  const job = docOf([
    {
      id: "job",
      type: "paperExperience",
      props: { role: "Engineer", company: "Acme", period: "", location: "" },
    },
  ])
  const held = coerceCvPaste(new Slice(job.content, 0, 0), 1, "list")
  const heldText = textIn(held, "bulletListItem").text
  expect(heldText).toContain("Engineer")
  expect(heldText).toContain("Acme")

  let skills = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([
      header,
      {
        id: "skills",
        type: "paperSkills",
        props: { label: "Tools" },
        children: [{ id: "a", type: "paperSkillItem", content: "SQLExcel" }],
      },
    ]),
    plugins: [cvRulesPlugin],
  })
  let textPos = -1
  skills.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes("SQLExcel")) textPos = pos
  })
  expect(textPos).toBeGreaterThan(0)
  skills = skills.apply(skills.tr.insertText(",", textPos + 3))
  const labels: string[] = []
  skills.doc.descendants((node) => {
    if (node.type.name === "paperSkillItem") labels.push(node.textContent)
  })
  expect(labels).toEqual(["SQL", "Excel"])
  expect(skills.selection.$from.parent.textContent).toBe("Excel")

  let kept = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([
      header,
      {
        id: "skills",
        type: "paperSkills",
        props: { label: "Tools" },
        children: [{ id: "cpp", type: "paperSkillItem", content: "C, C++" }],
      },
    ]),
    plugins: [cvRulesPlugin],
  })
  kept = kept.apply(kept.tr.setSelection(TextSelection.create(kept.doc, 1)))
  const keptLabels: string[] = []
  kept.doc.descendants((node) => {
    if (node.type.name === "paperSkillItem") keptLabels.push(node.textContent)
  })
  expect(keptLabels).toEqual(["C, C++"])
  let keptPos = -1
  kept.doc.descendants((node, pos) => {
    if (node.isText && node.text === "C, C++") keptPos = pos
  })
  kept = kept.apply(kept.tr.insertText("x", keptPos))
  const edited: string[] = []
  kept.doc.descendants((node) => {
    if (node.type.name === "paperSkillItem") edited.push(node.textContent)
  })
  expect(edited).toEqual(["xC, C++"])

  const slashTitles = cvSlashItems({}).map((item) => item.title)
  expect(slashTitles.filter((title) => title === "Skills")).toEqual(["Skills"])
  expect(slashTitles).toContain("Skill group")

  const titled = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([header, later]),
  })
  let titleEnd = -1
  titled.doc.descendants((node, pos) => {
    if (node.isText && node.text === "Education") {
      titleEnd = pos + node.text.length
    }
  })
  expect(titleEnd).toBeGreaterThan(0)
  const swallow = cvRulesPlugin.props.handleTextInput!(
    { state: titled } as never,
    titleEnd,
    titleEnd,
    "/",
    () => false
  )
  expect(swallow).toBe(true)
  expect(titled.doc.textContent).not.toContain("/")
  const body = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([{ id: "p", type: "paragraph", content: "Note" }]),
  })
  let noteEnd = -1
  body.doc.descendants((node, pos) => {
    if (node.isText && node.text === "Note") noteEnd = pos + node.text.length
  })
  expect(
    cvRulesPlugin.props.handleTextInput!(
      { state: body } as never,
      noteEnd,
      noteEnd,
      "/",
      () => false
    )
  ).toBe(false)

  expect(
    filterCvSlash(
      [{ title: "Experience" }, { title: "Skills" }, { title: "Summary" }],
      "exp"
    ).map((item) => item.title)
  ).toEqual(["Experience"])
  expect(
    filterCvSlash(
      [{ title: "Experience" }, { title: "Skills" }, { title: "Summary" }],
      "s"
    ).map((item) => item.title)
  ).not.toContain("Experience")
  expect(addedBlockType("bulletListItem", "paperExperience")).toBe(
    "bulletListItem"
  )
  expect(addedBlockType("paragraph", undefined)).toBe("paragraph")
  expect(cvFormatHidden(true, null)).toBe(true)
  expect(cvFormatHidden(false, "paperExperience")).toBe(true)
  expect(cvFormatHidden(false, "paragraph")).toBe(false)
})

function relocate(state: EditorState, id: string, beforeId: string) {
  const nodes: { node: Node; pos: number }[] = []
  state.doc.child(0).forEach((node, offset) => {
    nodes.push({ node, pos: offset + 1 })
  })
  const dragging = nodes.find((item) => item.node.attrs.id === id)
  const target = nodes.find((item) => item.node.attrs.id === beforeId)
  if (!dragging || !target) throw new Error("missing block")
  const tr = state.tr.delete(
    dragging.pos,
    dragging.pos + dragging.node.nodeSize
  )
  return state.apply(tr.insert(tr.mapping.map(target.pos), dragging.node))
}
