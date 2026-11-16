import type { InlinePresentation } from "@workspace/domain/internal/paper-presentation"
import { compileFlowNativeDocx } from "../../../apps/api/src/paper/native-output/formatted.js"
import { readPackageZip } from "../../../apps/api/src/paper/package-zip.js"
import { afterEach, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import { openRichPaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const cleanups = new Set<() => void>()
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const states = [undefined, false, true] as const
const combinations = states.flatMap((bold) =>
  states.flatMap((italic) =>
    states.flatMap((underline) =>
      states.flatMap((strike) =>
        [false, true].flatMap((linked) =>
          [undefined, "#AA0000"].map((color) => ({
            marks: { bold, italic, underline, strike, color },
            linked,
          }))
        )
      )
    )
  )
)

it.each(["cv", "letter"] as const)(
  "matches page, Underline state and Word for every unset/on/off mark combination in a %s",
  async (kind) => {
    vi.stubGlobal("CSS", { escape: (value: string) => value })
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [],
    })
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(),
    })
    const input = storedFlowFixture(kind)
    const section = input.flow.children[0]!
    const cascade = [
      undefined,
      "normal",
      "title",
      "heading-1",
      "heading-2",
      "heading-3",
    ].flatMap((paragraphStyle) =>
      [undefined, "plain", "strong"].flatMap((characterStyle) =>
        states.flatMap((bold) =>
          [undefined, 300].flatMap((size) =>
            [false, true].map((linked) => ({
              marks: { bold, size, characterStyle },
              linked,
              paragraphStyle,
              inheritedUnderline: false,
            }))
          )
        )
      )
    )
    const rows: {
      marks: InlinePresentation
      linked: boolean
      inheritedUnderline: boolean
      paragraphStyle?: string
      id: string
    }[] = [
      ...[false, true].flatMap((inheritedUnderline) =>
        combinations.map((combination) => ({
          ...combination,
          marks: {
            ...combination.marks,
            characterStyle: inheritedUnderline ? "underlined" : undefined,
          },
          inheritedUnderline,
          paragraphStyle: undefined,
        }))
      ),
      ...cascade,
    ].map((row, index) => ({ ...row, id: `case-${index}` }))
    const source = richPaperDocumentSchema.parse({
      ...input,
      presentation: {
        ...input.presentation,
        inline: { size: 240, strike: true, color: "#009900" },
        styles: [
          {
            id: "plain",
            kind: "character",
            parent: null,
            values: { size: 360, bold: false },
          },
          {
            id: "strong",
            kind: "character",
            parent: null,
            values: { size: 360, bold: true },
          },
          {
            id: "underlined",
            kind: "character",
            parent: null,
            values: { underline: true },
          },
        ],
      },
      flow: {
        ...input.flow,
        children: [
          {
            ...section,
            children: [
              ...section.children.filter((node) => node.type === "header"),
              ...rows.map(({ marks, linked, paragraphStyle, id }) => ({
                id,
                type: "paragraph",
                paragraph: { paragraphStyle },
                content: [
                  {
                    ...marks,
                    text: id,
                    href: linked ? "https://example.com/career" : undefined,
                  },
                ],
              })),
            ],
          },
        ],
      },
    })
    const server = new Y.Doc()
    Y.applyUpdate(server, seedStoredYDoc(source))
    const provenance = nativeProvenance(source)
    const client = openRichPaperClient(null, { provenance })
    expect(
      client.receive(client.prepare(), {
        provenance,
        epoch: 1,
        revision: 0,
        reset: false,
        stale: false,
        update: Y.encodeStateAsUpdate(server),
        stateVector: Y.encodeStateVector(server),
      }).failed
    ).toBe(false)
    const lease = borrowFlowDocument(client.ydoc, kind)
    const host = document.createElement("div")
    document.body.append(host)
    const mounted = mountPrivateFlow(lease.binding, host)
    cleanups.add(() => {
      mounted.unmount()
      lease.release()
      client.ydoc.destroy()
      server.destroy()
      host.remove()
    })
    const { version, schemaRevision, ...flow } = source
    expect([version, schemaRevision]).toEqual([4, 2])
    const compiled = compileFlowNativeDocx({
      document: flow,
      generation: "rich",
    })
    if (compiled.kind === "refused") throw new Error(compiled.reason)
    const { files } = await readPackageZip(compiled.value)
    const xmlPart = (name: string) => {
      const xml = files.get(name)
      if (!xml) throw new Error(`Missing Word part ${name}`)
      return {
        root: new DOMParser().parseFromString(
          xml.toString("utf8"),
          "application/xml"
        ).documentElement,
      }
    }
    const wordNamespace =
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    const elements = (root: Element, name: string) =>
      Array.from(root.getElementsByTagNameNS(wordNamespace, name))
    const attribute = (node: Element, name: string) =>
      node.getAttributeNS(wordNamespace, name) ?? undefined
    const one = (root: Element, name: string) => {
      const found = elements(root, name)
      expect(found).toHaveLength(1)
      return found[0]!
    }
    const part = xmlPart("word/document.xml")
    const styles = xmlPart("word/styles.xml")
    const defaults = one(one(styles.root, "docDefaults"), "rPr")
    const namedStyles = new Map(
      elements(styles.root, "style").map((style) => [
        attribute(style, "styleId"),
        style,
      ])
    )
    const wordRuns = new Map(
      elements(part.root, "r").map((run) => [run.textContent ?? "", run])
    )
    const spans = new Map(
      [...host.querySelectorAll<HTMLElement>("[data-paper-resolved]")].map(
        (span) => [span.textContent, span]
      )
    )
    const checkedActiveStates = new Set<string>()
    for (const {
      marks,
      linked,
      inheritedUnderline,
      paragraphStyle,
      id,
    } of rows) {
      const span = spans.get(id)
      const run = wordRuns.get(id)
      if (!span || !run) throw new Error(`Missing rendered run ${id}`)
      const paragraphStyles: Record<string, { size: number; bold: boolean }> = {
        title: { size: 520, bold: false },
        "heading-1": { size: 400, bold: true },
        "heading-2": { size: 320, bold: true },
        "heading-3": { size: 280, bold: true },
      }
      const paragraph = paragraphStyles[paragraphStyle ?? ""]
      const character =
        marks.characterStyle === "plain"
          ? { size: 360, bold: false }
          : marks.characterStyle === "strong"
            ? { size: 360, bold: true }
            : undefined
      const direct: InlinePresentation = marks
      const expected = {
        size: direct.size ?? character?.size ?? paragraph?.size ?? 240,
        bold: marks.bold ?? character?.bold ?? paragraph?.bold ?? false,
        underline: marks.underline ?? (linked || inheritedUnderline),
        strike: marks.strike ?? true,
        color: marks.color ?? (linked ? "#1D4ED8" : "#009900"),
      }
      const color = document.createElement("span")
      color.style.color = expected.color
      const page = {
        size: Number.parseFloat(span.style.fontSize) * 20,
        bold: span.style.fontWeight === "700",
        underline: span.style.textDecorationLine.includes("underline"),
        strike: span.style.textDecorationLine.includes("line-through"),
        color: span.style.color,
      }
      const runStyle = elements(run, "rStyle")[0]
      const namedStyle = runStyle && namedStyles.get(attribute(runStyle, "val"))
      let paragraphElement = run.parentElement!
      while (
        paragraphElement.localName !== "p" &&
        paragraphElement.parentElement
      )
        paragraphElement = paragraphElement.parentElement
      const paragraphId = elements(paragraphElement, "pStyle")[0]
      const paragraphDefinition =
        paragraphId && namedStyles.get(attribute(paragraphId, "val"))
      const sources = [run, namedStyle, paragraphDefinition, defaults].filter(
        (source): source is Element => Boolean(source)
      )
      const value = (name: string) => {
        for (const source of sources) {
          const property = elements(source, name)[0]
          if (property) return attribute(property, "val")
        }
      }
      const word = {
        size: Number(value("sz")) * 10,
        bold: value("b") === "1",
        underline: value("u") === "single",
        strike: value("strike") === "1",
        color: `#${value("color")}`,
      }
      expect(page, id).toEqual({ ...expected, color: color.style.color })
      expect(word, id).toEqual(expected)
      const wordColor = document.createElement("span")
      wordColor.style.color = word.color
      expect(page, id).toEqual({ ...word, color: wordColor.style.color })
      expect(span.style.fontWeight, id).toBe(expected.bold ? "700" : "400")
      expect(span.style.fontStyle, id).toBe(marks.italic ? "italic" : "normal")
      const activeState = `${linked}:${marks.underline}:${inheritedUnderline}:${paragraphStyle}:${marks.characterStyle}`
      if (checkedActiveStates.has(activeState)) continue
      checkedActiveStates.add(activeState)
      mounted.editor.setTextCursorPosition(id, "start")
      const state = mounted.editor.prosemirrorState
      mounted.editor.prosemirrorView.dispatch(
        state.tr.setSelection(
          TextSelection.create(
            state.doc,
            state.selection.from,
            state.selection.from + id.length
          )
        )
      )
      const active: InlinePresentation = mounted.activeInline()
      expect(active.underline, id).toBe(page.underline)
      expect(active.size, id).toBe(page.size)
      expect(active.bold ?? false, id).toBe(page.bold)
      expect(mounted.activeFormatting().underline, id).toBe(page.underline)
      expect(mounted.activeFormatting().size, id).toBe(String(page.size / 20))
      expect(mounted.activeFormatting().bold, id).toBe(page.bold)
    }
  },
  60_000
)
