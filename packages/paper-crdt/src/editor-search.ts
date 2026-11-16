import { Fragment, type Node } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import { yUndoPluginKey } from "y-prosemirror"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"

export type PaperSearchMatch = { readonly from: number; readonly to: number }
export type PaperSearchState = {
  readonly query: string
  readonly matchCase: boolean
  readonly matches: readonly PaperSearchMatch[]
  readonly activeIndex: number
}

type SearchAction =
  | { kind: "query"; query: string; matchCase: boolean }
  | { kind: "move"; direction: 1 | -1 }
  | { kind: "close" }

const empty: PaperSearchState = {
  query: "",
  matchCase: false,
  matches: [],
  activeIndex: -1,
}
const key = new PluginKey<PaperSearchState>("paperSearch")
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" })
const normalize = (text: string, matchCase: boolean) => {
  const normalized = text.normalize("NFC")
  return matchCase ? normalized : normalized.toLowerCase()
}

export function paperSearchMatches(
  doc: Node,
  query: string,
  matchCase: boolean
) {
  const needle = normalize(query, matchCase)
  const matches: PaperSearchMatch[] = []
  if (!needle) return matches
  const search = (original: string, start: number) => {
    let text = ""
    const ranges: PaperSearchMatch[] = []
    for (const segment of graphemes.segment(original)) {
      const normalized = normalize(segment.segment, matchCase)
      text += normalized
      for (let index = 0; index < normalized.length; index++)
        ranges.push({
          from: start + segment.index,
          to: start + segment.index + segment.segment.length,
        })
    }
    let offset = 0
    while (offset <= text.length - needle.length) {
      const found = text.indexOf(needle, offset)
      if (found < 0) break
      const first = ranges[found]
      const last = ranges[found + needle.length - 1]
      if (
        first &&
        last &&
        ranges[found - 1]?.from !== first.from &&
        ranges[found + needle.length]?.to !== last.to
      )
        matches.push({ from: first.from, to: last.to })
      offset = found + needle.length
    }
  }
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    let text = ""
    let start = pos + 1
    node.forEach((child, offset) => {
      if (child.isText) text += child.text ?? ""
      else {
        search(text, start)
        text = ""
        start = pos + 1 + offset + child.nodeSize
      }
    })
    search(text, start)
    return false
  })
  return matches
}

function replacement(doc: Node, match: PaperSearchMatch, text: string) {
  const source = Array.from(
    graphemes.segment(doc.textBetween(match.from, match.to))
  )
  const target = Array.from(graphemes.segment(text))
  const nodes = target.map((segment, index) => {
    const original = source[Math.floor((index * source.length) / target.length)]
    const position = match.from + (original?.index ?? 0)
    const marks = doc.resolve(position).nodeAfter?.marks ?? []
    return doc.type.schema.text(segment.segment, marks)
  })
  return Fragment.fromArray(nodes)
}

const subscriptions = new WeakMap<EditorView, Set<() => void>>()

export function paperSearchPlugin() {
  return new Plugin<PaperSearchState>({
    key,
    state: {
      init: () => empty,
      apply(tr, previous) {
        const action: SearchAction | undefined = tr.getMeta(key)
        if (action?.kind === "close") return empty
        if (action?.kind === "move") {
          const count = previous.matches.length
          return count
            ? {
                ...previous,
                activeIndex:
                  (previous.activeIndex + action.direction + count) % count,
              }
            : previous
        }
        if (action?.kind !== "query" && !tr.docChanged) return previous
        const query = action?.kind === "query" ? action.query : previous.query
        const matchCase =
          action?.kind === "query" ? action.matchCase : previous.matchCase
        const matches = paperSearchMatches(tr.doc, query, matchCase)
        const old = previous.matches[previous.activeIndex]
        const position = old ? tr.mapping.map(old.from) : 0
        const next =
          action?.kind === "query"
            ? 0
            : matches.findIndex((match) => match.from >= position)
        return {
          query,
          matchCase,
          matches,
          activeIndex: matches.length ? Math.max(0, next) : -1,
        }
      },
    },
    props: {
      decorations(state) {
        const search = key.getState(state) ?? empty
        return DecorationSet.create(
          state.doc,
          search.matches.map((match, index) =>
            Decoration.inline(match.from, match.to, {
              class:
                index === search.activeIndex
                  ? "paper-search-match paper-search-current"
                  : "paper-search-match",
              ...(index === search.activeIndex
                ? { "data-paper-search-active": "true" }
                : {}),
            })
          )
        )
      },
    },
    view: () => ({
      update: (updated, previous) => {
        if (key.getState(updated.state) !== key.getState(previous))
          for (const listener of subscriptions.get(updated) ?? []) listener()
      },
    }),
  })
}

export function richEditorSearch(editor: PrivateLayoutEditor) {
  const view = editor.prosemirrorView
  const listeners = new Set<() => void>()
  subscriptions.set(view, listeners)
  let active = true
  const snapshot = () => (active ? (key.getState(view.state) ?? empty) : empty)
  const scroll = () =>
    view.dom
      .querySelector("[data-paper-search-active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  const dispatch = (action: SearchAction) => {
    if (!active) return
    view.dispatch(
      view.state.tr.setMeta(key, action).setMeta("addToHistory", false)
    )
    scroll()
  }
  return {
    snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    find(query: string, matchCase: boolean) {
      dispatch({ kind: "query", query, matchCase })
    },
    move(direction: 1 | -1) {
      dispatch({ kind: "move", direction })
    },
    close() {
      dispatch({ kind: "close" })
    },
    replace(text: string, all: boolean) {
      if (!active || !editor.isEditable) return 0
      const state = snapshot()
      const current = state.matches[state.activeIndex]
      const matches = all ? state.matches : current ? [current] : []
      if (!matches.length) return 0
      const history = yUndoPluginKey.getState(view.state)?.undoManager
      history?.stopCapturing()
      const tr = view.state.tr
      for (const match of [...matches].reverse())
        tr.replaceWith(
          match.from,
          match.to,
          replacement(view.state.doc, match, text)
        )
      view.dispatch(tr)
      history?.stopCapturing()
      scroll()
      return matches.length
    },
    destroy() {
      if (!active) return
      active = false
      listeners.clear()
      subscriptions.delete(view)
    },
  }
}
