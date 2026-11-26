import type { RichText } from "@workspace/domain/paper-doc"

export function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function assertCanonicalInput(value: unknown): void {
  if (typeof value === "string") {
    for (const char of value) {
      const code = char.codePointAt(0) ?? 0
      if (
        !(
          code === 9 ||
          code === 10 ||
          (code >= 32 && code <= 0xd7ff) ||
          (code >= 0xe000 && code <= 0xfffd) ||
          (code >= 0x10000 && code <= 0x10ffff)
        ) ||
        code === 127
      )
        throw new Error("Native Letter output requires canonical XML text")
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach(assertCanonicalInput)
    return
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "content" && !Array.isArray(item))
        throw new Error("Native Letter output requires canonical rich runs")
      assertCanonicalInput(item)
    }
  }
}

export type ExternalLink = { id: string; target: string }

export function wordRun(
  text: string,
  properties: string,
  href: string | undefined,
  links: ExternalLink[]
): string {
  const content = text
    .split(/([\t\n])/u)
    .map((value) =>
      value === "\t"
        ? "<w:tab/>"
        : value === "\n"
          ? "<w:br/>"
          : value === ""
            ? ""
            : `<w:t xml:space="preserve">${xml(value)}</w:t>`
    )
    .join("")
  const body = `<w:r><w:rPr>${properties}</w:rPr>${content}</w:r>`
  if (!href) return body
  let link = links.find((entry) => entry.target === href)
  if (!link) {
    link = { id: `link${links.length + 1}`, target: href }
    links.push(link)
  }
  return `<w:hyperlink r:id="${link.id}" w:history="1">${body}</w:hyperlink>`
}

export function richRuns(runs: RichText, links: ExternalLink[]): string {
  return runs
    .map((run) => {
      const properties = [
        run.bold ? "<w:b/>" : "",
        run.italic ? "<w:i/>" : "",
        run.underline ? '<w:u w:val="single"/>' : "",
      ].join("")
      return wordRun(run.text, properties, run.href, links)
    })
    .join("")
}
