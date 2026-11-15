import { afterEach, describe, expect, it } from "vitest"
import { BlockNoteEditor } from "@blocknote/core"
import * as Y from "yjs"
import { cvSlots } from "@workspace/domain"
import {
  formatTargetSchema,
  formattedDocumentSchema,
  type PrivateFormattedDocument,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  nativeFormattingSchema,
  type PrivateFormattingEditor,
} from "./native-formatting-schema.js"
import { canonicalStyles, engineStyles } from "./native-formatting-styles.js"
import {
  toFormattingBlocks,
  fromFormattingBlocks,
} from "./native-formatting-cv.js"
import {
  createPrivateFormatting,
  openFormattedBinary,
  readFormatting,
  writePrivateFormatting,
  writePrivateFormattingBlocks,
  writePrivateFormattingEngine,
} from "./native-formatting.js"
import { admitFormattingInlineHtml } from "./native-formatting-letter.js"
import {
  applyFormatting,
  prepareFormatting,
  reverseFormatting,
} from "./presentation-codec.js"
import { canonicalTarget, type EngineBinding } from "./presentation-binding.js"
import { selectedRuns } from "./presentation-inline.js"
declare const document: {
  createElement(tag: "div"): Parameters<typeof admitFormattingInlineHtml>[0]
}
const docs = new Set<Y.Doc>()
const editors = new Set<PrivateFormattingEditor>()
afterEach(() => {
  for (const editor of editors) editor._tiptapEditor.destroy()
  for (const doc of docs) doc.destroy()
  editors.clear()
  docs.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
const presentation = {
  codecVersion: 1,
  page: {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  },
  inline: { bold: true, fontId: "liberation-serif" },
  paragraph: {},
  styles: [
    { id: "accent", kind: "character", parent: null, values: { italic: true } },
  ],
}
function letter(): PrivateFormattedDocument {
  return formattedDocumentSchema.parse({
    profile: "private-formatting-1",
    kind: "letter",
    presentation,
    blocks: [
      {
        id: "p",
        type: "paragraph",
        paragraph: {
          alignment: "right",
          lineSpacing: { kind: "multiple", value: 1.2 },
          before: 120,
          after: 240,
          start: 360,
          end: 180,
          indent: { kind: "hanging", value: 120 },
          keepNext: false,
          keepTogether: true,
          widowOrphan: false,
        },
        content: [
          {
            text: "Việt e\u0302 😀",
            bold: false,
            italic: true,
            underline: false,
            strike: true,
            color: "#123456",
            highlight: "#ABCDEF",
            fontId: "liberation-sans",
            size: 240,
            characterStyle: "accent",
            href: "https://example.com/path",
          },
        ],
      },
      { id: "empty", type: "paragraph", paragraph: {}, content: [] },
    ],
  })
}
function binding(input = letter()) {
  const binding = value(createPrivateFormatting(input))
  docs.add(binding.doc)
  editors.add(binding.engine)
  return binding
}
function editor(binding: EngineBinding) {
  const engine = BlockNoteEditor.create({
    schema: nativeFormattingSchema,
    initialContent: toFormattingBlocks(readFormatting(binding)),
  })
  editors.add(engine)
  return engine
}
function persist(binding: EngineBinding, engine: PrivateFormattingEditor) {
  const expected = fromFormattingBlocks(
    engine.document,
    binding.kind,
    readFormatting(binding).presentation
  )
  expect(
    writePrivateFormattingEngine(binding, engine, "real-engine-write").kind
  ).toBe("ok")
  expect(readFormatting(binding)).toEqual(expected)
  const fresh = openFormattedBinary(
    Y.encodeStateAsUpdate(binding.doc),
    binding.kind
  )
  docs.add(fresh.doc)
  editors.add(fresh.engine)
  expect(readFormatting(fresh)).toEqual(expected)
  return expected
}
function unchanged(binding: EngineBinding, work: () => unknown) {
  const bytes = Y.encodeStateAsUpdate(binding.doc),
    vector = Y.encodeStateVector(binding.doc),
    snapshot = readFormatting(binding)
  let updates = 0
  const count = () => updates++
  binding.doc.on("update", count)
  try {
    work()
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
    expect(Y.encodeStateVector(binding.doc)).toEqual(vector)
    expect(readFormatting(binding)).toEqual(snapshot)
    expect(updates).toBe(0)
  } finally {
    binding.doc.off("update", count)
  }
}
function first(document: PrivateFormattedDocument) {
  const node = document.blocks[0]
  if (!node || !("content" in node)) throw new Error("No first inline node")
  return node
}
function caret(engine: PrivateFormattingEditor, id: string, offset?: number) {
  engine.setTextCursorPosition(id, "start")
  if (offset !== undefined) {
    const start = engine.prosemirrorState.selection.from
    engine._tiptapEditor.commands.setTextSelection(start + offset)
  }
}
function toggleExplicitBold(engine: PrivateFormattingEditor) {
  const active = canonicalStyles(engine.getActiveStyles())
  const effective = active.bold ?? presentation.inline.bold
  engine.addStyles(engineStyles({ bold: !effective }))
}
describe("declared formatting schema with actual BlockNote and ProseMirror edits", () => {
  it("maps false to off, reads active state, changes and toggles, and types with full binary roundtrips", () => {
    const source = binding(),
      engine = editor(source)
    caret(engine, "p", 1)
    expect(engine.getActiveStyles().bold).toBe("off")
    expect(canonicalStyles(engine.getActiveStyles()).bold).toBe(false)
    expect(Boolean(engine.getActiveStyles().bold)).toBe(true)
    const beforePending = Y.encodeStateAsUpdate(source.doc)
    toggleExplicitBold(engine)
    expect(engine.getActiveStyles().bold).toBe("on")
    expect(Y.encodeStateAsUpdate(source.doc)).toEqual(beforePending)
    engine.transact((tr) => tr.insertText("ON"))
    const changed = persist(source, engine)
    expect(first(changed).content).toContainEqual(
      expect.objectContaining({ text: "ON", bold: true })
    )
    toggleExplicitBold(engine)
    expect(engine.getActiveStyles().bold).toBe("off")
    engine.transact((tr) => tr.insertText("OFF"))
    const off = persist(source, engine)
    expect(selectedRuns(first(off).content, 3, 6)).toEqual([
      { ...first(letter()).content[0], text: "OFF" },
    ])
    expect(first(off).paragraph).toEqual(first(letter()).paragraph)
    expect(
      first(off).content.every((run) => run.href === "https://example.com/path")
    ).toBe(true)
    const reloadedEngine = editor(source)
    persist(source, reloadedEngine)
  })
  it("distinguishes absent inherited values from direct off and removes every omitted old attribute", () => {
    const source = binding(),
      engine = editor(source)
    engine.updateBlock("p", {
      content: [{ type: "text", text: "plain e\u0302 😀", styles: {} }],
      props: {
        textAlignment: undefined,
        lineKind: undefined,
        lineValue: undefined,
        spaceBefore: undefined,
        spaceAfter: undefined,
        indentStart: undefined,
        indentEnd: undefined,
        indentKind: undefined,
        indentValue: undefined,
        keepNext: undefined,
        keepTogether: undefined,
        widowOrphan: undefined,
        paragraphStyle: undefined,
      },
    })
    const absent = persist(source, engine)
    expect(first(absent).content).toEqual([{ text: "plain e\u0302 😀" }])
    expect(first(absent).paragraph).toEqual({})
    caret(engine, "p", 1)
    expect(canonicalStyles(engine.getActiveStyles()).bold).toBeUndefined()
    toggleExplicitBold(engine)
    expect(canonicalStyles(engine.getActiveStyles()).bold).toBe(false)
    engine.transact((tr) => tr.insertText("off"))
    const result = persist(source, engine)
    expect(first(result).content.some((run) => run.bold === false)).toBe(true)
    engine.removeStyles({ bold: "off" })
    expect(canonicalStyles(engine.getActiveStyles()).bold).toBeUndefined()
    expect(readFormatting(source).presentation.inline.bold).toBe(true)
  })
  it("refuses unadapted boolean toolbar and bare keyboard marks before any Yjs persistence", () => {
    const source = binding(),
      blocks = toFormattingBlocks(readFormatting(source))
    const first = blocks[0]!
    for (const raw of [true, false])
      unchanged(source, () => {
        const candidate = [
          {
            ...first,
            content: [{ type: "text", text: "changed", styles: { bold: raw } }],
          },
          ...blocks.slice(1),
        ]
        expect(
          writePrivateFormattingBlocks(source, candidate, "old-toolbar").kind
        ).toBe("refused")
      })
    for (const raw of [true, false]) {
      const unadapted = editor(source)
      caret(unadapted, "p", 1)
      Reflect.apply(unadapted.addStyles, unadapted, [{ bold: raw }])
      unadapted.transact((tr) => tr.insertText("unadapted"))
      unchanged(source, () =>
        expect(
          writePrivateFormattingEngine(
            source,
            unadapted,
            "boolean-style-manager"
          ).kind
        ).toBe("refused")
      )
    }
    const engine = editor(source)
    const bold = engine.pmSchema.marks.bold
    if (!bold) throw new Error("Missing bold mark")
    caret(engine, "p", 1)
    engine.transact((tr) =>
      tr.addStoredMark(bold.create({ stringValue: true })).insertText("bad")
    )
    unchanged(source, () =>
      expect(
        writePrivateFormattingEngine(source, engine, "old-toggle").kind
      ).toBe("refused")
    )
    const keyboard = editor(source)
    caret(keyboard, "p", 1)
    const bare = keyboard.pmSchema.marks.bold
    if (!bare) throw new Error("Missing keyboard mark")
    keyboard.transact((tr) =>
      tr.addStoredMark(bare.create()).insertText("bad-keyboard")
    )
    unchanged(source, () =>
      expect(
        writePrivateFormattingEngine(source, keyboard, "bare-keyboard").kind
      ).toBe("refused")
    )
  })
  it("admits a real parsed styled HTML slice before engine paste and preserves codepoints and safe hrefs", () => {
    const source = binding(),
      engine = editor(source)
    const root = document.createElement("div")
    root.innerHTML =
      '<span data-paper-style="fontId" data-paper-value="liberation-mono"><span data-paper-style="size" data-paper-value="260"><span data-paper-style="color" data-paper-value="#112233"><span data-paper-style="highlight" data-paper-value="#FFEEDD"><span data-paper-style="bold" data-paper-value="off"><a href="https://paste.example">Paste Việt e\u0302 😀</a></span></span></span></span></span>'
    const html = value(admitFormattingInlineHtml(root))
    caret(engine, "empty")
    expect(engine._tiptapEditor.commands.insertContent(html)).toBe(true)
    engine.updateBlock("empty", {
      props: {
        textAlignment: "center",
        lineKind: "exact",
        lineValue: 320,
        keepNext: false,
      },
    })
    const result = persist(source, engine)
    const pasted = result.blocks.find((node) => node.id === "empty")
    expect(pasted).toMatchObject({
      paragraph: {
        alignment: "center",
        lineSpacing: { kind: "exact", value: 320 },
        keepNext: false,
      },
      content: [
        {
          text: "Paste Việt e\u0302 😀",
          bold: false,
          fontId: "liberation-mono",
          size: 260,
          color: "#112233",
          highlight: "#FFEEDD",
          href: "https://paste.example",
        },
      ],
    })
    const plain = document.createElement("div")
    plain.textContent = "Tiếng Việt e\u0302 😀"
    expect(value(admitFormattingInlineHtml(plain))).toContain("e\u0302")
    for (const html of [
      '<span data-paper-style="bold" data-paper-value="true">bad</span>',
      '<a href="javascript:alert(1)">bad</a>',
      '<span style="font-size:12px">bad</span>',
      '<img src="x">',
      '<span data-unknown="x">bad</span>',
    ])
      unchanged(source, () => {
        const bad = document.createElement("div")
        bad.innerHTML = html
        expect(admitFormattingInlineHtml(bad).kind).toBe("refused")
      })
    const badText = document.createElement("div")
    badText.textContent = "\ud800"
    unchanged(source, () =>
      expect(admitFormattingInlineHtml(badText).kind).toBe("refused")
    )
  })
  it("alternates formatting, real field rename and semantic reorder while keeping full CV tuples and empty slots", () => {
    const fields = (id: string, type: "header" | "section") =>
      cvSlots[type].map((fieldKey) => ({
        id: id + "-" + fieldKey,
        type: "cvField",
        ownerId: id,
        fieldKey,
        paragraph: {},
        content: [],
      }))
    const document = formattedDocumentSchema.parse({
      profile: "private-formatting-1",
      kind: "cv",
      presentation,
      header: {
        id: "header",
        type: "header",
        children: fields("header", "header"),
      },
      blocks: [
        {
          id: "summary1",
          type: "section",
          kind: "summary",
          children: fields("summary1", "section"),
        },
        {
          id: "summary2",
          type: "section",
          kind: "summary",
          children: fields("summary2", "section"),
        },
        {
          id: "skills",
          type: "skills",
          children: [
            {
              id: "skills-label",
              type: "cvField",
              ownerId: "skills",
              fieldKey: "label",
              paragraph: {},
              content: [],
            },
            {
              id: "fa",
              type: "cvField",
              ownerId: "skills",
              fieldKey: "item",
              itemId: "ia",
              paragraph: {},
              content: [{ text: "same" }],
            },
            {
              id: "fb",
              type: "cvField",
              ownerId: "skills",
              fieldKey: "item",
              itemId: "ib",
              paragraph: {},
              content: [{ text: "same" }],
            },
          ],
        },
      ],
    })
    const source = binding(document)
    const target = formatTargetSchema.parse({
      kind: "cv-field",
      fieldId: "fa",
      ownerId: "skills",
      fieldKey: "item",
      itemId: "ia",
    })
    const receipt = value(
      applyFormatting(
        source,
        value(
          prepareFormatting(source, {
            kind: "inline",
            range: { target, from: 0, to: 4 },
            expected: [{ text: "same" }],
            values: { bold: false, color: "#123456" },
          })
        )
      )
    )
    const engine = editor(source)
    engine.updateBlock("fa", {
      content: [
        {
          type: "text",
          text: "renamed Việt e\u0302 😀",
          styles: engineStyles({ bold: false, color: "#123456" }),
        },
      ],
    })
    const renamed = persist(source, engine)
    expect(canonicalTarget(renamed, target)).toMatchObject({
      id: "fa",
      itemId: "ia",
      content: [
        { text: "renamed Việt e\u0302 😀", bold: false, color: "#123456" },
      ],
    })
    const semantic = readFormatting(source)
    if (semantic.kind !== "cv") throw new Error("Expected CV")
    const skills = semantic.blocks.find((node) => node.type === "skills")
    if (!skills || skills.type !== "skills") throw new Error("Expected skills")
    const [label, a, b] = skills.children
    if (!label || !a || !b) throw new Error("Missing skills")
    skills.children = [label, b, a]
    expect(
      writePrivateFormatting(source, semantic, "semantic-reorder").kind
    ).toBe("ok")
    expect(readFormatting(source)).toEqual(semantic)
    persist(source, editor(source))
    expect(canonicalTarget(readFormatting(source), target)).toMatchObject({
      ownerId: "skills",
      fieldKey: "item",
      itemId: "ia",
    })
    unchanged(source, () =>
      expect(reverseFormatting(source, receipt).kind).toBe("refused")
    )
    const newline = editor(source)
    newline.updateBlock("fa", {
      content: [{ type: "text", text: "bad\nfield", styles: {} }],
    })
    unchanged(source, () =>
      expect(
        writePrivateFormattingEngine(source, newline, "field-enter").kind
      ).toBe("refused")
    )
    const duplicate = toFormattingBlocks(readFormatting(source))
    duplicate.push(duplicate[1]!)
    unchanged(source, () =>
      expect(
        writePrivateFormattingBlocks(source, duplicate, "duplicate").kind
      ).toBe("refused")
    )
  })
})
