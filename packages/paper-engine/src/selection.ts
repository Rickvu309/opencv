import type { Node } from "prosemirror-model"
import {
  AllSelection,
  NodeSelection,
  Selection as PmSelection,
  TextSelection,
} from "prosemirror-state"
import type {
  BlockId,
  Selection,
  SelectionCommand,
} from "@workspace/domain/paper-doc"

import {
  containerAt,
  fromPm,
  posIndex,
  toPm,
  type Container,
} from "./positions.js"

type Point = { at: number; offset: number }

const WORD = /[\p{L}\p{N}_'’]/u
const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff

const containerText = (doc: Node, container: Container) =>
  doc.textBetween(container.start, container.start + container.size, "\n", "\n")

export function readSelection(doc: Node, selection: PmSelection): Selection {
  if (selection instanceof AllSelection) return { kind: "all" }
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    return { kind: "block", block: selection.node.attrs.id as BlockId }
  }
  return {
    kind: "text",
    anchor: fromPm(doc, selection.anchor),
    head: fromPm(doc, selection.head),
  }
}

export function toPmSelection(
  doc: Node,
  selection: Selection
): PmSelection | null {
  if (selection.kind === "all") return new AllSelection(doc)
  if (selection.kind === "block") {
    const entry = posIndex(doc).blocks.get(selection.block)
    return entry ? NodeSelection.create(doc, entry.pos) : null
  }
  const anchor = toPm(doc, selection.anchor)
  const head = toPm(doc, selection.head)
  if (anchor === null || head === null) return null
  if (!containerAt(doc, anchor) || !containerAt(doc, head)) return null
  return TextSelection.create(doc, anchor, head)
}

function pointAt(doc: Node, pm: number): Point | null {
  const containers = posIndex(doc).containers
  const container = containerAt(doc, pm)
  if (container) {
    return { at: containers.indexOf(container), offset: pm - container.start }
  }
  const after = containers.findIndex((candidate) => candidate.start >= pm)
  if (after >= 0) return { at: after, offset: 0 }
  const last = containers.at(-1)
  return last ? { at: containers.length - 1, offset: last.size } : null
}

function stepChar(doc: Node, point: Point, dir: -1 | 1): Point {
  const containers = posIndex(doc).containers
  const container = containers[point.at]!
  const text = containerText(doc, container)
  if (dir > 0) {
    if (point.offset >= container.size) {
      return point.at + 1 < containers.length
        ? { at: point.at + 1, offset: 0 }
        : point
    }
    const pair =
      isHigh(text.charCodeAt(point.offset)) &&
      isLow(text.charCodeAt(point.offset + 1))
    return { at: point.at, offset: point.offset + (pair ? 2 : 1) }
  }
  if (point.offset <= 0) {
    return point.at > 0
      ? { at: point.at - 1, offset: containers[point.at - 1]!.size }
      : point
  }
  const pair =
    isLow(text.charCodeAt(point.offset - 1)) &&
    isHigh(text.charCodeAt(point.offset - 2))
  return { at: point.at, offset: point.offset - (pair ? 2 : 1) }
}

function stepWord(doc: Node, point: Point, dir: -1 | 1): Point {
  const containers = posIndex(doc).containers
  const container = containers[point.at]!
  const text = containerText(doc, container)
  let offset = point.offset
  if (dir > 0) {
    if (offset >= text.length) return stepChar(doc, point, 1)
    while (offset < text.length && !WORD.test(text[offset]!)) offset += 1
    while (offset < text.length && WORD.test(text[offset]!)) offset += 1
    return { at: point.at, offset }
  }
  if (offset <= 0) return stepChar(doc, point, -1)
  while (offset > 0 && !WORD.test(text[offset - 1]!)) offset -= 1
  while (offset > 0 && WORD.test(text[offset - 1]!)) offset -= 1
  return { at: point.at, offset }
}

function stepPoint(
  doc: Node,
  point: Point,
  unit: Extract<SelectionCommand, { op: "move" }>["unit"],
  dir: -1 | 1
): Point {
  const containers = posIndex(doc).containers
  const size = (at: number) => containers[at]!.size
  const last = containers.length - 1
  switch (unit) {
    case "char":
      return stepChar(doc, point, dir)
    case "word":
      return stepWord(doc, point, dir)
    case "lineEdge":
      return { at: point.at, offset: dir > 0 ? size(point.at) : 0 }
    case "doc":
      return dir > 0 ? { at: last, offset: size(last) } : { at: 0, offset: 0 }
    case "line": {
      const at = point.at + dir
      if (at < 0) return { at: 0, offset: 0 }
      if (at > last) return { at: last, offset: size(last) }
      return { at, offset: Math.min(point.offset, size(at)) }
    }
    case "block":
      if (dir > 0) {
        return point.at < last
          ? { at: point.at + 1, offset: 0 }
          : { at: last, offset: size(last) }
      }
      if (point.offset > 0) return { at: point.at, offset: 0 }
      return { at: Math.max(0, point.at - 1), offset: 0 }
  }
}

const pmOf = (doc: Node, point: Point) =>
  posIndex(doc).containers[point.at]!.start + point.offset

function edges(doc: Node, selection: PmSelection) {
  const containers = posIndex(doc).containers
  if (selection instanceof AllSelection) {
    const last = containers.length - 1
    return {
      from: { at: 0, offset: 0 },
      to: { at: last, offset: containers[last]!.size },
    }
  }
  const from = pointAt(doc, selection.from)!
  const to = pointAt(doc, selection.to)!
  return { from, to }
}

function wordAround(doc: Node, point: Point): [Point, Point] {
  const container = posIndex(doc).containers[point.at]!
  const text = containerText(doc, container)
  let start = point.offset
  let end = point.offset
  while (start > 0 && WORD.test(text[start - 1]!)) start -= 1
  while (end < text.length && WORD.test(text[end]!)) end += 1
  return [
    { at: point.at, offset: start },
    { at: point.at, offset: end },
  ]
}

export function applySelection(
  doc: Node,
  current: PmSelection,
  command: SelectionCommand
): PmSelection | null {
  if (command.op === "select") return toPmSelection(doc, command.selection)
  if (command.op === "selectAll") return new AllSelection(doc)
  if (posIndex(doc).containers.length === 0) return null
  if (command.op === "selectBlock") {
    const point = pointAt(doc, current.head)!
    const block = posIndex(doc).containers[point.at]!.blockIndex
    let pos = 0
    for (let index = 0; index < block; index += 1) {
      pos += doc.child(index).nodeSize
    }
    return NodeSelection.create(doc, pos)
  }
  if (command.op === "selectWord") {
    const [start, end] = wordAround(doc, pointAt(doc, current.head)!)
    return TextSelection.create(doc, pmOf(doc, start), pmOf(doc, end))
  }
  const { from, to } = edges(doc, current)
  const textual = current instanceof TextSelection
  if (command.extend) {
    const anchor = textual
      ? pointAt(doc, current.anchor)!
      : command.dir > 0
        ? from
        : to
    const head = textual
      ? pointAt(doc, current.head)!
      : command.dir > 0
        ? to
        : from
    const moved = stepPoint(doc, head, command.unit, command.dir)
    return TextSelection.create(doc, pmOf(doc, anchor), pmOf(doc, moved))
  }
  const collapsed = !current.empty || !textual
  const start = collapsed
    ? command.dir > 0
      ? to
      : from
    : pointAt(doc, current.head)!
  const moved =
    collapsed && command.unit === "char"
      ? start
      : stepPoint(doc, start, command.unit, command.dir)
  const pm = pmOf(doc, moved)
  return TextSelection.create(doc, pm, pm)
}
