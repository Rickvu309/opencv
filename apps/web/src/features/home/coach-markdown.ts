export type CoachInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: CoachInline[] }
  | { type: "em"; children: CoachInline[] }
  | { type: "code"; text: string }

export type CoachMarkdownBlock =
  | { type: "p"; children: CoachInline[] }
  | { type: "ul"; items: CoachInline[][] }
  | { type: "ol"; items: CoachInline[][] }
  | { type: "pre"; text: string }

const FENCE = "```"

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

  for (const line of lines) {
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

export function parseInline(text: string): CoachInline[] {
  const tokens: CoachInline[] = []
  let i = 0

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

    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2)
      if (end !== -1) {
        tokens.push({
          type: "strong",
          children: parseInline(text.slice(i + 2, end)),
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
          children: parseInline(text.slice(i + 1, end)),
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
