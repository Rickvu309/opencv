import { attr, byLocal, paragraphText, xmlDoc } from "./source-line.ts"

function plain(node: Element | null) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim()
}

function heading(node: Element | null) {
  if (!node || node.classList.contains("source-header")) return false
  if (node.classList.contains("source-rule")) return false
  const text = plain(node)
  return text.length > 0 && text.length <= 40 && !text.endsWith(":")
}

function greeting(node: Element | null) {
  if (!node || node.classList.contains("source-header")) return false
  const text = plain(node)
  return text.length > 0 && text.length <= 80 && text.endsWith(":")
}

function columnTail(node: Element | null) {
  if (!node?.classList.contains("source-columns")) return false
  const last = [...node.querySelectorAll("p")]
    .filter((item) => plain(item) && !item.classList.contains("source-header"))
    .pop()
  return heading(last ?? null)
}

function followingRule(node: Element) {
  let next = node.nextElementSibling
  while (next && !plain(next)) {
    if (next.classList.contains("source-rule")) return next
    next = next.nextElementSibling
  }
  return null
}

function previousPlain(start: Element): Element | null {
  let lead: Element | null = start.previousElementSibling
  while (lead && !plain(lead)) lead = lead.previousElementSibling
  if (lead) return lead
  const page = start.closest("section.docx")
  if (!page) return null
  const articles = [...page.querySelectorAll(":scope > article")]
  const parent = start.parentElement
  for (
    let index = parent ? articles.indexOf(parent as HTMLElement) - 1 : -1;
    index >= 0;
    index--
  ) {
    const found = [...(articles[index]?.children ?? [])]
      .reverse()
      .find((node) => plain(node))
    if (found) return found
  }
  let previous = page.previousElementSibling
  while (previous && !previous.matches("section.docx")) {
    previous = previous.previousElementSibling
  }
  if (!previous) return null
  const earlier = [...previous.querySelectorAll(":scope > article")]
  for (let index = earlier.length - 1; index >= 0; index--) {
    const found = [...(earlier[index]?.children ?? [])]
      .reverse()
      .find((node) => plain(node))
    if (found) return found
  }
  return (
    [...previous.querySelectorAll(".source-header")]
      .reverse()
      .find((node) => plain(node)) ?? null
  )
}

export function keepSet(block: Element) {
  const keep: Element[] = []
  const prev = previousPlain(block)
  if (prev?.classList.contains("source-rule") && heading(previousPlain(prev))) {
    const title = previousPlain(prev)
    if (title) keep.push(title, prev)
  } else if (columnTail(prev)) {
    if (prev) keep.push(prev)
  } else if (prev && (greeting(prev) || heading(prev))) {
    const earlier = previousPlain(prev)
    if (columnTail(earlier) && earlier) keep.push(earlier)
    keep.push(prev)
    const rule = followingRule(prev)
    if (rule) keep.push(rule)
  }
  const leadStart = keep[0] ?? block
  const lead = previousPlain(leadStart)
  if (lead?.classList.contains("source-header")) keep.unshift(lead)
  return keep
}

function firstPlain(page: Element) {
  for (const article of page.querySelectorAll(":scope > article")) {
    const found = [...article.children].find((node) => plain(node))
    if (found) return found
  }
  return null
}

export function joinKeptGroups(root: ParentNode) {
  const pages = [...root.querySelectorAll("section.docx")]
  for (const page of pages.slice(1)) {
    const block = firstPlain(page)
    const article = block?.parentElement
    if (!block || !article) continue
    const keep = keepSet(block).filter((node) => !page.contains(node))
    for (const node of keep) article.insertBefore(node, block)
  }
}

export function headerSplitNote(root: ParentNode) {
  const pages = [...root.querySelectorAll("section.docx")]
  const pageOf = (node: Element) =>
    pages.indexOf(node.closest("section.docx") as Element) + 1
  const nodes = [
    ...root.querySelectorAll(".source-header, section.docx article > *"),
  ]
  const notes: string[] = []
  for (const header of root.querySelectorAll(".source-header")) {
    const next = nodes
      .slice(nodes.indexOf(header) + 1)
      .find((node) => !node.classList.contains("source-header") && plain(node))
    if (!next || pageOf(next) === pageOf(header)) continue
    notes.push(
      `Header "${plain(header)}" stays on page ${pageOf(header)} while its section starts on page ${pageOf(next)}.`
    )
  }
  return notes.join(" ")
}

function headerLabel(partXml: string) {
  const doc = xmlDoc(partXml)
  const choice = byLocal(doc, "Choice")[0]
  if (!choice) return ""
  const box = byLocal(choice, "txbxContent")[0]
  if (!box) return ""
  return paragraphText(box).replace(/\s+/g, " ").trim()
}

export function paintHeaders(
  root: ParentNode,
  documentXml: string,
  headers: Record<string, string>
) {
  const labels: Record<string, string> = {}
  for (const [id, xml] of Object.entries(headers)) labels[id] = headerLabel(xml)
  const body = byLocal(xmlDoc(documentXml), "body")[0]
  if (!body) return
  const sections: { header: string; anchor: string }[] = []
  let buffer: Element[] = []
  let current = ""
  const flush = (section: Element) => {
    const refs = byLocal(section, "headerReference")
    const ref =
      refs.find((node) => (attr(node, "type") || "default") === "default") ??
      refs[0]
    if (refs.length) current = labels[attr(ref, "id")] || ""
    const anchor = (
      buffer.map((node) => paragraphText(node).trim()).find(Boolean) ?? ""
    ).slice(0, 48)
    if (anchor && current) sections.push({ header: current, anchor })
    buffer = []
  }
  for (const child of [...body.children]) {
    if (child.localName === "sectPr") {
      flush(child)
      continue
    }
    buffer.push(child)
    const inner = byLocal(child, "sectPr")[0]
    if (inner) flush(inner)
  }
  for (const page of root.querySelectorAll("section.docx")) {
    let header = page.querySelector(":scope > header")
    if (!header) {
      header = document.createElement("header")
      page.prepend(header)
    }
    for (const hit of sections) {
      if (
        [...page.querySelectorAll(".source-header")].some(
          (node) => node.textContent === hit.header
        )
      ) {
        continue
      }
      const block = [...page.querySelectorAll(":scope > article > *")].find(
        (node) => (node.textContent ?? "").includes(hit.anchor)
      )
      if (!block) continue
      const element = document.createElement("p")
      element.className = "source-header"
      element.textContent = hit.header
      element.setAttribute("contenteditable", "false")
      element.title = "Read-only header"
      element.setAttribute("aria-label", `Read-only header ${hit.header}`)
      const firstArticle = page.querySelector(":scope > article")
      if (
        block.parentElement === firstArticle &&
        block.matches(":first-child")
      ) {
        header.prepend(element)
      } else block.before(element)
    }
  }
}

export function paintRules(root: ParentNode, documentXml: string) {
  for (const paragraph of byLocal(xmlDoc(documentXml), "p")) {
    const geom = byLocal(paragraph, "prstGeom").find(
      (node) => node.getAttribute("prst") === "straightConnector1"
    )
    if (!geom) continue
    let shape: Element | null = geom
    while (shape && shape.localName !== "wsp") shape = shape.parentElement
    const extent = shape
      ? byLocal(shape, "ext").find((node) => node.getAttribute("cx"))
      : undefined
    const label = paragraphText(paragraph).trim()
    const host = [...root.querySelectorAll("article p")].find(
      (node) =>
        (node.textContent ?? "").includes(label) &&
        !node.nextElementSibling?.classList.contains("source-rule")
    )
    if (!host || !extent) continue
    const rule = document.createElement("div")
    rule.className = "source-rule"
    rule.style.width = `${(Number(extent.getAttribute("cx")) * 96) / 914400}px`
    rule.setAttribute("role", "separator")
    rule.setAttribute("aria-label", "Horizontal rule")
    host.after(rule)
  }
}

export function bindTails(root: ParentNode) {
  for (const paragraph of root.querySelectorAll("article p")) {
    if (
      paragraph.classList.contains("source-pair") ||
      paragraph.classList.contains("source-header")
    ) {
      continue
    }
    const tab = [...paragraph.querySelectorAll("span")].find(
      (node) => node.childNodes.length === 1 && node.textContent === "\u2003"
    )
    if (tab) {
      const tail = document.createElement("span")
      tail.className = "source-tail"
      let next = tab.nextSibling
      while (next) {
        const following = next.nextSibling
        if (next instanceof HTMLBRElement) break
        tail.append(next)
        next = following
      }
      tab.remove()
      if (!plain(tail)) continue
      paragraph.classList.add("source-pair")
      paragraph.append(tail)
      continue
    }
    const stop = paragraph.querySelector("br")
    const range = document.createRange()
    range.setStart(paragraph, 0)
    if (stop) range.setEndBefore(stop)
    else range.selectNodeContents(paragraph)
    const raw = range.toString()
    const match = raw.match(/^(.*?)\s{8,}(\S.*?)\s*$/)
    const tailText = match?.[2].trim() ?? ""
    if (!match || !match[1]?.trim() || !tailText || tailText.slice(48) !== "")
      continue
    if (paragraph.querySelector("img, table, .source-rule")) continue
    const left = document.createElement("span")
    left.textContent = match[1].trim()
    const tail = document.createElement("span")
    tail.className = "source-tail"
    tail.textContent = tailText
    range.deleteContents()
    range.insertNode(tail)
    range.insertNode(left)
    paragraph.classList.add("source-pair")
  }
}
