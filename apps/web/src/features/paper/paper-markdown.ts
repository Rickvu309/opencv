/** Lightweight markdown ↔ HTML for Paper prototype content. */

function inlineMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

export function paperContentToHtml(content: string): string {
  const lines = content.split("\n")
  const html: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trimEnd()

    if (trimmed.startsWith("## ")) {
      if (inList) {
        html.push("</ul>")
        inList = false
      }
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`)
      continue
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>")
        inList = true
      }
      html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`)
      continue
    }

    if (inList) {
      html.push("</ul>")
      inList = false
    }

    if (trimmed === "") {
      html.push("<p><br></p>")
      continue
    }

    html.push(`<p>${inlineMarkdown(trimmed)}</p>`)
  }

  if (inList) html.push("</ul>")
  return html.join("")
}

function nodeTextWithMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ""
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as HTMLElement
  if (el.tagName === "STRONG" || el.tagName === "B") {
    return `**${nodeTextWithMarkdown(el)}**`
  }
  if (el.tagName === "BR") return "\n"

  return Array.from(el.childNodes).map(nodeTextWithMarkdown).join("")
}

export function paperHtmlToContent(root: HTMLElement): string {
  const parts: string[] = []

  for (const node of root.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as HTMLElement

    if (el.tagName === "H2") {
      parts.push(`## ${el.textContent?.trim() ?? ""}\n`)
      continue
    }

    if (el.tagName === "UL") {
      for (const li of el.querySelectorAll("li")) {
        parts.push(`- ${li.textContent?.trim() ?? ""}\n`)
      }
      parts.push("\n")
      continue
    }

    if (el.tagName === "P") {
      const text = nodeTextWithMarkdown(el).trim()
      if (text) parts.push(`${text}\n\n`)
      else parts.push("\n")
    }
  }

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
}
