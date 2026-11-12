import type { WordAlign, WordForm, WordMark } from "@workspace/domain"

export type WordPackageLook = {
  styleNames: ReadonlyMap<string, string>
  listKinds: ReadonlyMap<string, "bullet" | "number">
}

const VALUE = `w:val=["']([^"']*)["']`

function valueOf(xml: string, local: string): string | null {
  const found = new RegExp(`<w:${local}\\s[^>]*?${VALUE}`).exec(xml)
  return found?.[1] ?? null
}

function switchedOn(xml: string, local: string): boolean {
  const found = new RegExp(`<w:${local}(\\s[^>]*?)?/?>`).exec(xml)
  if (!found) return false
  const value = new RegExp(VALUE).exec(found[1] ?? "")?.[1]
  if (value === undefined) return true
  if (local === "u") return value !== "none"
  return !["0", "false", "off"].includes(value)
}

export function marksOf(props: string, linked = false): WordMark[] {
  const marks: WordMark[] = []
  if (switchedOn(props, "b")) marks.push("bold")
  if (switchedOn(props, "i")) marks.push("italic")
  if (switchedOn(props, "u")) marks.push("underline")
  if (linked) marks.push("link")
  return marks
}

export function packageLook(
  styles: string | null,
  numbering: string | null
): WordPackageLook {
  const styleNames = new Map<string, string>()
  for (const style of (styles ?? "").matchAll(
    /<w:style\s[^>]*?w:styleId=["']([^"']*)["'][^>]*>([\s\S]*?)<\/w:style>/g
  )) {
    const name = valueOf(style[2] ?? "", "name")
    if (style[1] && name) styleNames.set(style[1], name)
  }
  const levelKinds = new Map<string, "bullet" | "number">()
  for (const abstract of (numbering ?? "").matchAll(
    /<w:abstractNum\s[^>]*?w:abstractNumId=["']([^"']*)["'][^>]*>([\s\S]*?)<\/w:abstractNum>/g
  )) {
    for (const level of (abstract[2] ?? "").matchAll(
      /<w:lvl\s[^>]*?w:ilvl=["']([^"']*)["'][^>]*?(?:\/>|>([\s\S]*?)<\/w:lvl>)/g
    )) {
      const format = valueOf(level[2] ?? "", "numFmt")
      levelKinds.set(
        `${abstract[1]}:${level[1]}`,
        format === "bullet" ? "bullet" : "number"
      )
    }
  }
  const listKinds = new Map<string, "bullet" | "number">()
  for (const num of (numbering ?? "").matchAll(
    /<w:num\s[^>]*?w:numId=["']([^"']*)["'][^>]*>([\s\S]*?)<\/w:num>/g
  )) {
    const abstract = valueOf(num[2] ?? "", "abstractNumId")
    for (const [key, kind] of levelKinds) {
      const [owner, level] = key.split(":")
      if (owner === abstract) listKinds.set(`${num[1]}:${level}`, kind)
    }
  }
  return { styleNames, listKinds }
}

function listForm(props: string, look: WordPackageLook): WordForm | null {
  const numbered = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(props)?.[1]
  if (numbered === undefined) return null
  const num = valueOf(numbered, "numId")
  if (num === null || num === "0") return null
  const level = Math.min(8, Math.max(0, Number(valueOf(numbered, "ilvl") ?? 0)))
  const kind = look.listKinds.get(`${num}:${level}`) ?? "number"
  return { kind, level: Number.isInteger(level) ? level : 0 }
}

function styleForm(props: string, look: WordPackageLook): WordForm | null {
  const style = valueOf(props, "pStyle")
  if (style === null) return null
  const name = (look.styleNames.get(style) ?? style)
    .toLowerCase()
    .replace(/\s+/g, "")
  if (name === "title") return { kind: "title" }
  const heading = /^heading([1-6])$/.exec(name)?.[1]
  if (heading) return { kind: "heading", level: Number(heading) }
  const list = /^list(bullet|number)([2-9])?$/.exec(name)
  if (list?.[1] === "bullet" || list?.[1] === "number")
    return { kind: list[1], level: list[2] ? Number(list[2]) - 1 : 0 }
  return null
}

const ALIGNS: Record<string, WordAlign> = {
  center: "center",
  right: "end",
  end: "end",
  both: "justify",
  distribute: "justify",
}

export function paragraphLook(
  props: string,
  look: WordPackageLook
): { form?: WordForm; align?: WordAlign } {
  const form = listForm(props, look) ?? styleForm(props, look)
  const align = ALIGNS[valueOf(props, "jc") ?? ""]
  return {
    ...(form ? { form } : {}),
    ...(align ? { align } : {}),
  }
}
