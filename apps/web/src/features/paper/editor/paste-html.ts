import {
  blockSchema,
  isSafeHref,
  type Block,
  type Run,
} from "@workspace/domain/paper-doc"
import { paperSchema } from "@workspace/paper-engine"
import {
  DOMParser,
  Fragment,
  Mark,
  type Node,
  type ParseRule,
} from "prosemirror-model"

type TextAttrs = Extract<Block, { type: "text_block" }>["attrs"]
type ListAttrs = Pick<TextAttrs, "list" | "level">
const noList: ListAttrs = { list: null, level: 0 }
const maxCells = 10_000
const listTags = "ul, ol"
const blockTags =
  "p, div, section, article, blockquote, h1, h2, h3, h4, h5, h6, table, hr"

function unwrap(node: Element) {
  node.replaceWith(...node.childNodes)
}

function removeBlockWhitespace(parent: Element) {
  for (const node of [...parent.childNodes]) {
    if (
      node.nodeType === 3 &&
      /^[ \t\r\n]*$/.test(node.textContent ?? "") &&
      ((node.previousSibling instanceof Element &&
        node.previousSibling.matches(blockTags)) ||
        (node.nextSibling instanceof Element &&
          node.nextSibling.matches(blockTags)))
    )
      node.remove()
  }
}

function listLevel(level: number): TextAttrs["level"] {
  return (
    ([0, 1, 2, 3, 4, 5, 6, 7, 8] as const)[Math.min(8, Math.max(0, level))] ?? 0
  )
}

function flattenParagraphs(parent: Element) {
  for (const child of [...parent.children]) {
    if (!child.matches("p, div, h1, h2, h3, h4, h5, h6")) continue
    if (
      child.previousSibling?.textContent?.trim() ||
      child.previousElementSibling
    )
      child.before(parent.ownerDocument.createElement("br"))
    unwrap(child)
  }
}

function wordLists(root: Element, lists: WeakMap<Element, ListAttrs>) {
  const numbering = new Map<string, string>()
  for (const style of root.querySelectorAll("style")) {
    for (const match of (style.textContent ?? "").matchAll(
      /@list\s+(\S+:level\d+)\s*\{([^}]+)\}/gi
    )) {
      const format = /mso-level-number-format:\s*([\w-]+)/i.exec(match[2]!)?.[1]
      if (format) numbering.set(match[1]!.toLowerCase(), format.toLowerCase())
    }
  }

  for (const block of root.querySelectorAll("p[style], div[style]")) {
    const match = /mso-list:\s*(\S+)\s+level(\d+)/i.exec(
      block.getAttribute("style") ?? ""
    )
    if (!match) continue
    const markers = [...block.querySelectorAll("[style]")].filter((child) =>
      /mso-list:\s*ignore\b/i.test(child.getAttribute("style") ?? "")
    )
    const comments = [...block.childNodes].filter((node) => node.nodeType === 8)
    for (const comment of comments) {
      if (!/\[if\s+!supportLists\]/i.test(comment.textContent ?? "")) continue
      let end = comment.nextSibling
      while (end && end.nodeType !== 8) end = end.nextSibling
      if (!end || !/endif/i.test(end.textContent ?? "")) continue
      while (comment.nextSibling && comment.nextSibling !== end)
        block.removeChild(comment.nextSibling)
      comment.parentNode?.removeChild(comment)
      end.parentNode?.removeChild(end)
    }
    const marker = markers
      .map((node) => node.textContent)
      .join("")
      .trim()
    const format = numbering.get(`${match[1]!.toLowerCase()}:level${match[2]}`)
    const numbered = format
      ? format !== "bullet"
      : /^[\dA-Za-z]+[.)]/.test(marker)
    for (const node of markers) node.remove()
    lists.set(block, {
      list: numbered ? "numbered" : "bullet",
      level: listLevel(Number(match[2]) - 1),
    })
  }
}

function webLists(root: Element, lists: WeakMap<Element, ListAttrs>) {
  const depths = new WeakMap<Element, number>()
  for (const list of root.querySelectorAll(listTags)) {
    const nested = list.parentElement?.closest(listTags)
    const level = nested ? (depths.get(nested) ?? 0) + 1 : 0
    depths.set(list, level)

    for (const item of [...list.children]) {
      if (!item.matches("li")) continue
      const paragraph = item.ownerDocument.createElement("p")
      lists.set(paragraph, {
        list: list.matches("ol") ? "numbered" : "bullet",
        level: listLevel(level),
      })
      const nestedLists = [...item.querySelectorAll(listTags)].filter(
        (child) => child.parentElement?.closest(listTags) === list
      )
      flattenParagraphs(item)
      paragraph.append(...item.childNodes)
      item.replaceWith(paragraph, ...nestedLists)
    }
  }
  const ordered = [...root.querySelectorAll(listTags)].reverse()
  for (const list of ordered) unwrap(list)
}

function simpleTables(root: Element, widthMpt: number) {
  const widths = new WeakMap<Element, number[]>()
  for (const table of root.querySelectorAll("table")) {
    const rows = [...table.rows]
    const cols = rows[0]?.cells.length ?? 0
    if (
      cols === 0 ||
      rows.length * cols > maxCells ||
      table.querySelector("table") ||
      rows.some(
        (row) =>
          row.cells.length !== cols ||
          [...row.cells].some(
            (cell) => cell.colSpan !== 1 || cell.rowSpan !== 1
          )
      )
    ) {
      const lines = rows.map((row) => {
        const paragraph = table.ownerDocument.createElement("p")
        paragraph.textContent = [...row.cells]
          .map((cell) => cell.textContent)
          .join("\t")
        return paragraph
      })
      table.replaceWith(...lines)
      continue
    }
    const each = Math.max(1, Math.floor(widthMpt / cols))
    widths.set(
      table,
      Array.from({ length: cols }, () => each)
    )
    for (const row of rows)
      for (const cell of row.cells) flattenParagraphs(cell)
  }
  return widths
}

function clipboardRules(
  lists: WeakMap<Element, ListAttrs>,
  widths: WeakMap<Element, number[]>
): ParseRule[] {
  const textBlock = (tag: string, kind: TextAttrs["kind"]): ParseRule => ({
    tag,
    node: "text_block",
    getAttrs: (element) => ({ kind, ...(lists.get(element) ?? noList) }),
  })
  return [
    {
      tag: "table",
      node: "table",
      getAttrs: (el) => {
        const columnsMpt = widths.get(el)
        return columnsMpt ? { columnsMpt, borders: "all" } : false
      },
    },
    { tag: "tr", node: "table_row", context: "table/" },
    { tag: "td, th", node: "table_cell", context: "table_row/" },
    { tag: "br", node: "hard_break" },
    { tag: "hr", node: "divider" },
    textBlock("h1, p.MsoHeading1", "heading"),
    textBlock("h2, h3, h4, h5, h6, p.MsoHeading2", "subheading"),
    textBlock("p.MsoTitle", "title"),
    textBlock("p.MsoSubtitle", "subtitle"),
    textBlock("p", "paragraph"),
    { tag: "strong, b", mark: "bold" },
    { tag: "em, i", mark: "italic" },
    { tag: "u", mark: "underline" },
    { tag: "s, strike, del", mark: "strike" },
    {
      style: "font-weight",
      mark: "bold",
      getAttrs: (weight) =>
        weight === "bold" || Number(weight) >= 600 ? null : false,
    },
    {
      style: "font-weight=normal",
      clearMark: (mark) => mark.type.name === "bold",
    },
    { style: "font-style=italic", mark: "italic" },
    {
      style: "text-decoration-line",
      mark: "underline",
      consuming: false,
      getAttrs: (value) =>
        value.split(" ").includes("underline") ? null : false,
    },
    {
      style: "text-decoration-line",
      mark: "strike",
      getAttrs: (value) =>
        value.split(" ").includes("line-through") ? null : false,
    },
    {
      tag: "a[href]",
      mark: "link",
      getAttrs: (element) => {
        const href = element.getAttribute("href")?.trim() ?? ""
        return isSafeHref(href) ? { href } : false
      },
    },
  ]
}

function cleanBreaks(node: Node): Node {
  if (node.type.name === "hard_break") return node.mark(Mark.none)
  if (node.isLeaf) return node
  const children: Node[] = []
  node.forEach((child) => children.push(cleanBreaks(child)))
  return node.copy(Fragment.fromArray(children))
}

function clipboardBlock(node: Node): Block | undefined {
  const attrs: Record<string, unknown> = { ...node.attrs, id: "clipboard" }
  if (attrs.rightTabMpt === null) delete attrs.rightTabMpt
  const result = blockSchema.safeParse({ ...cleanBreaks(node).toJSON(), attrs })
  return result.success ? result.data : undefined
}

export function pasteHtml(html: string, widthMpt: number): Block[] | Run[] {
  const template = document.createElement("template")
  template.innerHTML = html
  const root = template.content.ownerDocument.createElement("div")
  root.append(template.content)
  const lists = new WeakMap<Element, ListAttrs>()
  wordLists(root, lists)
  for (const node of root.querySelectorAll(
    "script, style, meta, link, iframe, object, embed, svg, math, template, form, noscript, [hidden]"
  ))
    node.remove()
  for (const node of [...root.getElementsByTagName("o:p")]) node.remove()
  for (const node of root.querySelectorAll('b[id^="docs-internal-guid"]'))
    unwrap(node)
  webLists(root, lists)
  const widths = simpleTables(root, widthMpt)
  removeBlockWhitespace(root)
  for (const node of root.querySelectorAll("div, section, article, blockquote"))
    removeBlockWhitespace(node)
  const parser = new DOMParser(paperSchema, clipboardRules(lists, widths))
  const parsed = parser.parse(root, {
    topNode: paperSchema.topNodeType.create({ page: null, template: null }),
  })
  const blocks: Block[] = []
  parsed.forEach((node) => {
    const block = clipboardBlock(node)
    if (block) blocks.push(block)
  })
  const only = blocks[0]
  if (
    blocks.length === 1 &&
    only?.type === "text_block" &&
    only.attrs.kind === "paragraph" &&
    only.attrs.list === null &&
    !root.querySelector("p, div, section, article, blockquote")
  ) {
    return only.content ?? []
  }
  if (!root.querySelector(blockTags) && !root.textContent?.trim()) return []
  return blocks
}
