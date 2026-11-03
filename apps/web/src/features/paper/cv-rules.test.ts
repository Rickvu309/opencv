import { BlockNoteEditor } from "@blocknote/core"
import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { paperSchema } from "@workspace/paper-crdt"
import { Slice, type Node } from "prosemirror-model"
import { EditorState } from "prosemirror-state"
import { ySyncPluginKey } from "y-prosemirror"
import { expect, it } from "vitest"

import { coerceCvPaste, cvRulesPlugin } from "./cv-rules.ts"

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
})
