import { LETTER_PROFILE } from "./profile.js"

export type ListKind = "bullet" | "numbered"
export type ListSequence = { id: number; kind: ListKind; depth: number }

export function numberingXml(sequences: readonly ListSequence[]): string {
  const abstracts = (["bullet", "numbered"] satisfies ListKind[])
    .map((kind, index) => {
      const levels = [0, 1, 2]
        .map((depth) => {
          const left = (depth + 1) * LETTER_PROFILE.listStep
          const format = kind === "bullet" ? "bullet" : "decimal"
          const text = kind === "bullet" ? "•" : `%${depth + 1}.`
          return `<w:lvl w:ilvl="${depth}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlRestart w:val="0"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${left}"/></w:tabs><w:ind w:left="${left}" w:hanging="${LETTER_PROFILE.hanging}"/></w:pPr></w:lvl>`
        })
        .join("")
      return `<w:abstractNum w:abstractNumId="${index}"><w:multiLevelType w:val="multilevel"/>${levels}</w:abstractNum>`
    })
    .join("")
  const instances = sequences
    .map(
      ({ id, kind, depth }) =>
        `<w:num w:numId="${id}"><w:abstractNumId w:val="${kind === "bullet" ? 0 : 1}"/><w:lvlOverride w:ilvl="${depth}"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`
    )
    .join("")
  return `${abstracts}${instances}`
}
