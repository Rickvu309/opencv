export type CoachInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: CoachInline[] }
  | { type: "em"; children: CoachInline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: CoachInline[] }

export type CoachHeadingLevel = 1 | 2 | 3

export type CoachMarkdownBlock =
  | { type: "p"; children: CoachInline[] }
  | { type: "heading"; level: CoachHeadingLevel; children: CoachInline[] }
  | { type: "table"; header: CoachInline[][]; rows: CoachInline[][][] }
  | { type: "ul"; items: CoachInline[][] }
  | { type: "ol"; items: CoachInline[][] }
  | { type: "pre"; text: string }

const FENCE = "```"

const SAFE_LINK = /^(?:https?:\/\/|mailto:)/i
const BARE_URL = /^https?:\/\/[^\s<>()]+/i
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/
const HEADING = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/

export function safeLinkHref(href: string): string | null {
  const trimmed = href.trim()
  if (!SAFE_LINK.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.href
      : null
  } catch {
    return null
  }
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableRow(line: string) {
  return line.includes("|") && line.trim() !== ""
}

export function parseCoachMarkdown(text: string): CoachMarkdownBlock[] {
  const blocks: CoachMarkdownBlock[] = []
  const chunks = splitFences(text)

  for (const chunk of chunks) {
    if (chunk.type === "pre") {
      blocks.push({ type: "pre", text: chunk.text })
      continue
    }
    blocks.push(...parseFlow(chunk.text))
  }

  return blocks.length > 0 ? blocks : [{ type: "p", children: [] }]
}

function splitFences(
  text: string
): Array<{ type: "flow" | "pre"; text: string }> {
  const chunks: Array<{ type: "flow" | "pre"; text: string }> = []
  let rest = text

  while (rest.length > 0) {
    const start = rest.indexOf(FENCE)
    if (start === -1) {
      chunks.push({ type: "flow", text: rest })
      break
    }
    if (start > 0) {
      chunks.push({ type: "flow", text: rest.slice(0, start) })
    }
    const afterOpen = rest.slice(start + FENCE.length)
    const newline = afterOpen.indexOf("\n")
    const bodyStart = newline === -1 ? afterOpen.length : newline + 1
    const end = afterOpen.indexOf(FENCE, bodyStart)
    const body =
      end === -1 ? afterOpen.slice(bodyStart) : afterOpen.slice(bodyStart, end)
    chunks.push({ type: "pre", text: body.replace(/\n$/, "") })
    rest =
      end === -1 ? "" : afterOpen.slice(end + FENCE.length).replace(/^\n/, "")
  }

  return chunks
}

function parseFlow(text: string): CoachMarkdownBlock[] {
  const blocks: CoachMarkdownBlock[] = []
  const lines = text.split("\n")
  let paragraph: string[] = []
  let list: { type: "ul" | "ol"; items: string[] } | null = null

  const flushParagraph = () => {
    const joined = paragraph.join("\n").trim()
    paragraph = []
    if (joined) {
      blocks.push({ type: "p", children: parseInline(joined) })
    }
  }

  const flushList = () => {
    if (!list) return
    blocks.push({
      type: list.type,
      items: list.items.map((item) => parseInline(item)),
    })
    list = null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      const depth = heading[1]?.length ?? 1
      blocks.push({
        type: "heading",
        level: depth <= 1 ? 1 : depth === 2 ? 2 : 3,
        children: parseInline(heading[2] ?? ""),
      })
      continue
    }

    const divider = lines[index + 1]
    if (
      isTableRow(line) &&
      divider !== undefined &&
      TABLE_DIVIDER.test(divider) &&
      divider.includes("|") === line.includes("|")
    ) {
      flushParagraph()
      flushList()
      const header = tableCells(line)
      const rows: CoachInline[][][] = []
      index += 2
      while (index < lines.length && isTableRow(lines[index] ?? "")) {
        const cells = tableCells(lines[index] ?? "")
        rows.push(header.map((_, column) => parseInline(cells[column] ?? "")))
        index += 1
      }
      index -= 1
      blocks.push({
        type: "table",
        header: header.map((cell) => parseInline(cell)),
        rows,
      })
      continue
    }

    const unordered = /^(?:[-*])\s+(.+)$/.exec(line)
    const ordered = /^(\d+)\.\s+(.+)$/.exec(line)

    if (unordered) {
      flushParagraph()
      if (list?.type !== "ul") {
        flushList()
        list = { type: "ul", items: [] }
      }
      list.items.push(unordered[1] ?? "")
      continue
    }

    if (ordered) {
      flushParagraph()
      if (list?.type !== "ol") {
        flushList()
        list = { type: "ol", items: [] }
      }
      list.items.push(ordered[2] ?? "")
      continue
    }

    if (line.trim() === "") {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

export function parseInline(text: string, links = true): CoachInline[] {
  const tokens: CoachInline[] = []
  let i = 0

  const pushNode = (node: CoachInline) => {
    if (node.type === "text") pushText(node.text)
    else tokens.push(node)
  }

  const pushText = (value: string) => {
    if (!value) return
    const last = tokens[tokens.length - 1]
    if (last?.type === "text") {
      last.text += value
      return
    }
    tokens.push({ type: "text", text: value })
  }

  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1)
      if (end !== -1) {
        tokens.push({ type: "code", text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (links && text[i] === "[") {
      const close = text.indexOf("](", i + 1)
      const end = close === -1 ? -1 : text.indexOf(")", close + 2)
      if (close !== -1 && end !== -1) {
        const href = safeLinkHref(text.slice(close + 2, end))
        const label = parseInline(text.slice(i + 1, close), false)
        if (href) tokens.push({ type: "link", href, children: label })
        else for (const node of label) pushNode(node)
        i = end + 1
        continue
      }
    }

    if (
      links &&
      text[i] === "h" &&
      (i === 0 || /[\s(]/.test(text[i - 1] ?? ""))
    ) {
      const bare = BARE_URL.exec(text.slice(i))
      const raw = bare?.[0].replace(TRAILING_PUNCTUATION, "") ?? ""
      const href = raw ? safeLinkHref(raw) : null
      if (href) {
        tokens.push({
          type: "link",
          href,
          children: [{ type: "text", text: raw }],
        })
        i += raw.length
        continue
      }
    }

    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2)
      if (end !== -1) {
        tokens.push({
          type: "strong",
          children: parseInline(text.slice(i + 2, end), links),
        })
        i = end + 2
        continue
      }
    }

    if (text[i] === "*" || text[i] === "_") {
      const marker = text[i]!
      const end = text.indexOf(marker, i + 1)
      if (end !== -1 && text[end + 1] !== marker) {
        tokens.push({
          type: "em",
          children: parseInline(text.slice(i + 1, end), links),
        })
        i = end + 1
        continue
      }
    }

    pushText(text[i]!)
    i += 1
  }

  return tokens
}
