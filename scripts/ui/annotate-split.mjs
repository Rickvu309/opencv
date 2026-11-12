import { join } from "node:path"

export const SPLIT_ABOVE = 2

export function sectionSlug(title) {
  const slug = String(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "section"
}

export function compositeFiles(sections, out, { single = false } = {}) {
  if (single || sections.length <= SPLIT_ABOVE)
    return [{ out, sections: sections.map((_, at) => at) }]
  const used = new Map()
  const stem = out.toLowerCase().endsWith(".png") ? out.slice(0, -4) : null
  return sections.map((section, at) => {
    const base = sectionSlug(section.title)
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    const name = count === 1 ? base : `${base}-${count}`
    return {
      out: stem ? `${stem}-${name}.png` : join(out, `${name}.png`),
      sections: [at],
    }
  })
}
