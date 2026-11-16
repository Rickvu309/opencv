import { Fragment, type Node } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
  yUndoPluginKey,
} from "y-prosemirror"
import type { RelativePosition } from "yjs"
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
  | { kind: "replace"; after: number }

const empty: PaperSearchState = {
  query: "",
  matchCase: false,
  matches: [],
  activeIndex: -1,
}
const key = new PluginKey<PaperSearchState>("paperSearch")
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" })
type SearchIndex = {
  readonly text: string
  readonly ranges: readonly PaperSearchMatch[]
}
const indexes = new WeakMap<Node, Map<boolean, readonly SearchIndex[]>>()

function normalizedIndex(
  original: string,
  matchCase: boolean,
  start = 0
): SearchIndex {
  let text = ""
  const ranges: PaperSearchMatch[] = []
  for (const segment of graphemes.segment(original)) {
    const canonical = segment.segment.normalize("NFC")
    const folded = matchCase
      ? canonical
      : canonical.toLowerCase().replace(/ς/g, "σ")
    text += folded
    const range = {
      from: start + segment.index,
      to: start + segment.index + segment.segment.length,
    }
    for (let index = 0; index < folded.length; index++) ranges.push(range)
  }
  return { text, ranges }
}

function blockIndexes(node: Node, matchCase: boolean) {
  let cached = indexes.get(node)
  const found = cached?.get(matchCase)
  if (found) return found
  const blocks: SearchIndex[] = []
  let text = ""
  let start = 1
  node.forEach((child, offset) => {
    if (child.isText) text += child.text ?? ""
    else {
      blocks.push(normalizedIndex(text, matchCase, start))
      text = ""
      start = 1 + offset + child.nodeSize
    }
  })
  blocks.push(normalizedIndex(text, matchCase, start))
  if (!cached) {
    cached = new Map()
    indexes.set(node, cached)
  }
  cached.set(matchCase, blocks)
  return blocks
}

export function paperSearchMatches(
  doc: Node,
  query: string,
  matchCase: boolean
) {
  const needle = normalizedIndex(query, matchCase).text
  const matches: PaperSearchMatch[] = []
  if (!needle) return matches
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    for (const { text, ranges } of blockIndexes(node, matchCase)) {
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
          matches.push({ from: pos + first.from, to: pos + last.to })
        offset = found + needle.length
      }
    }
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
  let anchor: RelativePosition | null = null
  const decorations = new WeakMap<PaperSearchState, DecorationSet>()
  const decorate = (
    doc: Node,
    search: PaperSearchState,
    mapped = DecorationSet.empty
  ) => {
    const remaining = new Map(
      mapped
        .find()
        .map((decoration) => [
          `${decoration.from}:${decoration.to}:${decoration.spec.active}`,
          decoration,
        ])
    )
    const added: Decoration[] = []
    search.matches.forEach((match, index) => {
      const active = index === search.activeIndex
      const id = `${match.from}:${match.to}:${active}`
      if (remaining.delete(id)) return
      added.push(
        Decoration.inline(
          match.from,
          match.to,
          {
            class: active
              ? "paper-search-match paper-search-current"
              : "paper-search-match",
            ...(active ? { "data-paper-search-active": "true" } : {}),
          },
          { active }
        )
      )
    })
    return mapped.remove([...remaining.values()]).add(doc, added)
  }
  return new Plugin<PaperSearchState>({
    key,
    state: {
      init: () => empty,
      apply(tr, previous, _oldState, newState) {
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
        const sync = ySyncPluginKey.getState(newState)
        const remotePosition =
          anchor && tr.getMeta(ySyncPluginKey)?.isChangeOrigin && sync
            ? relativePositionToAbsolutePosition(
                sync.doc,
                sync.type,
                anchor,
                sync.binding.mapping
              )
            : null
        const position =
          action?.kind === "replace"
            ? action.after
            : (remotePosition ?? (old ? tr.mapping.map(old.from) : 0))
        const next =
          action?.kind === "query"
            ? 0
            : matches.findIndex((match) => match.from >= position)
        const updated: PaperSearchState = {
          query,
          matchCase,
          matches,
          activeIndex: matches.length ? Math.max(0, next) : -1,
        }
        const cached = decorations.get(previous)
        if (cached)
          decorations.set(
            updated,
            decorate(tr.doc, updated, cached.map(tr.mapping, tr.doc))
          )
        return updated
      },
    },
    props: {
      decorations(state) {
        const search = key.getState(state) ?? empty
        const cached = decorations.get(search)
        if (cached) return cached
        const result = decorate(state.doc, search)
        decorations.set(search, result)
        return result
      },
    },
    view: () => ({
      update: (updated, previous) => {
        const search = key.getState(updated.state)
        const current = search?.matches[search.activeIndex]
        const sync = ySyncPluginKey.getState(updated.state)
        anchor =
          current && sync
            ? absolutePositionToRelativePosition(
                current.from,
                sync.type,
                sync.binding.mapping
              )
            : null
        if (search !== key.getState(previous))
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
      if (!all && current)
        tr.setMeta(key, {
          kind: "replace",
          after: tr.mapping.map(current.to, 1),
        } satisfies SearchAction)
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
