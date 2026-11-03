import { BlockNoteEditor } from "@blocknote/core"
import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { paperSchema } from "@workspace/paper-crdt"
import { Fragment, Slice, type Node } from "prosemirror-model"
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
  expect(ids(moved.doc)).toEqual(["header", "s2", "e2", "s1", "e1"])
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
  const skillView = {
    state: skills,
    dispatch(tr: typeof skills.tr) {
      skills = skills.apply(tr)
    },
  }
  expect(
    cvRulesPlugin.props.handleTextInput!(
      skillView as never,
      textPos + 3,
      textPos + 3,
      ",",
      () => false
    )
  ).toBe(true)
  const labels: string[] = []
  skills.doc.descendants((node) => {
    if (node.type.name === "paperSkillItem") labels.push(node.textContent)
  })
  expect(labels).toEqual(["SQL", "Excel"])
  expect(skills.selection.$from.parent.textContent).toBe("Excel")

  const typed = EditorState.create({
    schema: editor.pmSchema,
    doc: docOf([
      header,
      {
        id: "skills",
        type: "paperSkills",
        props: { label: "Tools" },
        children: [{ id: "empty", type: "paperSkillItem", content: "" }],
      },
    ]),
    plugins: [cvRulesPlugin],
  })
  let emptyPos = -1
  typed.doc.descendants((node, pos) => {
    if (node.type.name === "paperSkillItem" && node.textContent === "") {
      emptyPos = pos + 1
    }
  })
  let typedState = typed
  const typedView = {
    state: typedState,
    dispatch(tr: typeof typedState.tr) {
      typedState = typedState.apply(tr)
      typedView.state = typedState
    },
  }
  expect(
    cvRulesPlugin.props.handleTextInput!(
      typedView as never,
      emptyPos,
      emptyPos,
      "SQL,Excel",
      () => false
    )
  ).toBe(true)
  const typedLabels: string[] = []
  typedState.doc.descendants((node) => {
    if (node.type.name === "paperSkillItem") typedLabels.push(node.textContent)
  })
  expect(typedLabels).toEqual(["SQL", "Excel"])
  expect(typedState.selection.$from.parent.textContent).toBe("Excel")

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

  const whole = (content: string) =>
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf([
        header,
        {
          id: "skills",
          type: "paperSkills",
          props: { label: "Tools" },
          children: [{ id: "one", type: "paperSkillItem", content }],
        },
      ]),
      plugins: [cvRulesPlugin],
    })
  const skillLabels = (state: EditorState) => {
    const found: string[] = []
    state.doc.descendants((node) => {
      if (node.type.name === "paperSkillItem") found.push(node.textContent)
    })
    return found
  }
  const commit = (state: EditorState, tr: ReturnType<EditorState["tr"]>) => {
    const next = state.apply(tr)
    const extra = cvRulesPlugin.spec.appendTransaction?.([tr], state, next)
    return extra ? next.apply(extra) : next
  }
  const backspaceBeforeComma = (content: string) => {
    const state = whole(content)
    let at = -1
    state.doc.descendants((node, pos) => {
      if (at < 0 && node.isText && node.text === content) {
        at = pos + node.text.indexOf(",")
      }
    })
    return skillLabels(commit(state, state.tr.delete(at - 1, at)))
  }
  expect(backspaceBeforeComma("Node.js, TypeScript")).toEqual([
    "Node.j, TypeScript",
  ])
  expect(backspaceBeforeComma("1,000 users")).toEqual([",000 users"])

  let copied = whole("C, C++")
  let sourceNode: Node | null = null
  let sourcePos = -1
  copied.doc.descendants((node, pos) => {
    if (
      sourceNode === null &&
      node.type.name === "blockContainer" &&
      node.childCount > 0 &&
      node.child(0).type.name === "paperSkillItem"
    ) {
      sourceNode = node
      sourcePos = pos
    }
  })
  if (!sourceNode) throw new Error("missing skill")
  const skillNode = sourceNode as Node
  const copy = skillNode.type.create(
    { ...skillNode.attrs, id: "copy" },
    skillNode.content
  )
  copied = commit(
    copied,
    copied.tr.insert(sourcePos + skillNode.nodeSize, copy)
  )
  expect(skillLabels(copied)).toEqual(["C, C++", "C, C++"])

  let pastedSkill = whole("")
  let pasteAt = -1
  pastedSkill.doc.descendants((node, pos) => {
    if (pasteAt < 0 && node.type.name === "paperSkillItem") pasteAt = pos + 1
  })
  pastedSkill = pastedSkill.apply(
    pastedSkill.tr.setSelection(TextSelection.create(pastedSkill.doc, pasteAt))
  )
  const pasteView = {
    state: pastedSkill,
    dispatch(tr: typeof pastedSkill.tr) {
      pastedSkill = pastedSkill.apply(tr)
      pasteView.state = pastedSkill
    },
  }
  expect(
    cvRulesPlugin.props.handlePaste!(
      pasteView as never,
      { clipboardData: { getData: () => "a, b" } } as never,
      new Slice(Fragment.from(editor.pmSchema.text("a, b")), 0, 0)
    )
  ).toBe(true)
  expect(skillLabels(pastedSkill)).toEqual(["a", "b"])

  let fromSlice = whole("")
  let sliceAt = -1
  fromSlice.doc.descendants((node, pos) => {
    if (sliceAt < 0 && node.type.name === "paperSkillItem") sliceAt = pos + 1
  })
  fromSlice = fromSlice.apply(
    fromSlice.tr.setSelection(TextSelection.create(fromSlice.doc, sliceAt))
  )
  const sliceView = {
    state: fromSlice,
    dispatch(tr: typeof fromSlice.tr) {
      fromSlice = fromSlice.apply(tr)
      sliceView.state = fromSlice
    },
  }
  const pastedSlice = new Slice(
    Fragment.from(editor.pmSchema.text("a, b")),
    0,
    0
  )
  expect(
    cvRulesPlugin.props.handlePaste!(
      sliceView as never,
      { clipboardData: { getData: () => "" } } as never,
      pastedSlice
    )
  ).toBe(true)
  expect(skillLabels(fromSlice)).toEqual(["a", "b"])

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
  expect(
    cvRulesPlugin.props.handleTextInput!(
      { state: titled } as never,
      titleEnd,
      titleEnd,
      "/",
      () => false
    )
  ).toBe(false)
  expect(
    cvRulesPlugin.props.handleTextInput!(
      { state: titled } as never,
      titleEnd,
      titleEnd,
      "/exp",
      () => false
    )
  ).toBe(false)
  const withSlash = titled.apply(titled.tr.insertText("/", titleEnd))
  expect(withSlash.doc.textContent).toContain("Education/")
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

it("lands a section drop on a group boundary", () => {
  const skills = {
    id: "s3",
    type: "paperSection",
    props: { kind: "skills" },
    content: "Skills",
  }
  const tool = {
    id: "sk",
    type: "paperSkills",
    props: { label: "Tools" },
    children: [{ id: "sql", type: "paperSkillItem", content: "SQL" }],
  }
  const beta = {
    ...experience,
    id: "e2b",
    props: { ...experience.props, role: "Beta" },
  }
  const base = [header, section, experience, beta, later, school, skills, tool]
  const ontoHeading = relocate(
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf(base),
      plugins: [cvRulesPlugin],
    }),
    "s3",
    "e1"
  )
  expect(ids(ontoHeading.doc)).toEqual([
    "header",
    "s3",
    "sk",
    "s1",
    "e1",
    "e2b",
    "s2",
    "e2",
  ])
  const beforeMarker = relocate(
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf(base),
      plugins: [cvRulesPlugin],
    }),
    "s3",
    "s1"
  )
  expect(ids(beforeMarker.doc)).toEqual([
    "header",
    "s3",
    "sk",
    "s1",
    "e1",
    "e2b",
    "s2",
    "e2",
  ])
  const gamma = {
    ...experience,
    id: "e3",
    props: { ...experience.props, role: "Gamma" },
  }
  const delta = {
    ...experience,
    id: "e4",
    props: { ...experience.props, role: "Delta" },
  }
  const long = [header, section, experience, beta, gamma, delta, skills, tool]
  const nearEnd = relocate(
    EditorState.create({
      schema: editor.pmSchema,
      doc: docOf(long),
      plugins: [cvRulesPlugin],
    }),
    "s3",
    "e4"
  )
  expect(ids(nearEnd.doc)).toEqual([
    "header",
    "s1",
    "e1",
    "e2b",
    "e3",
    "e4",
    "s3",
    "sk",
  ])
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
