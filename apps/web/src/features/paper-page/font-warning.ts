import { attr, byLocal, xmlDoc } from "./source-line.ts"

export type FontFace = {
  family: string
  weight: string
}

const shownAs: Record<string, string> = {
  "Century Gothic": "Jost (different metrics)",
  Calibri: "Carlito (metric-compatible)",
  Cambria: "Caladea (metric-compatible)",
  Arial: "Liberation Sans (metric-compatible)",
  "Times New Roman": "Liberation Serif (metric-compatible)",
  "Courier New": "Liberation Mono (metric-compatible)",
  Georgia: "Liberation Serif (no certified equivalent)",
  Constantia: "Liberation Serif (no certified equivalent)",
  Garamond: "Liberation Serif (no certified equivalent)",
  Aptos: "Liberation Sans (no certified equivalent)",
  "Aptos Display": "Liberation Sans (no certified equivalent)",
  "Montserrat Light": "Montserrat (Light instance not certified)",
  "Cambria Math": "Liberation Serif (no math font shipped)",
}

const originalFace = new Set(["Open Sans", "Montserrat"])
const noFile = new Set([
  "Symbol",
  "Wingdings",
  "Segoe UI Emoji",
  "Noto Sans Symbols",
])

export function fontSentence(face: FontFace) {
  const name =
    face.weight !== "" && face.weight.toLowerCase() !== "regular"
      ? `${face.family} ${face.weight}`
      : face.family
  if (shownAs[name]) return `${name} is shown using ${shownAs[name]}.`
  if (shownAs[face.family]) {
    return `${face.family} is shown using ${shownAs[face.family]}.`
  }
  if (originalFace.has(name) || originalFace.has(face.family)) {
    return `${face.family} is the original font.`
  }
  if (noFile.has(name) || noFile.has(face.family)) {
    return `${face.family} is shown using no shipped file.`
  }
  return `${name} is shown using Liberation Sans (no certified equivalent).`
}

export function fontWarning(faces: FontFace[]) {
  const sentences: string[] = []
  for (const face of faces) {
    const sentence = fontSentence(face)
    if (!sentences.includes(sentence)) sentences.push(sentence)
  }
  return sentences.join(" ")
}

function addFace(faces: FontFace[], family: string, weight: string) {
  const trimmed = family.trim()
  if (!trimmed) return
  if (faces.some((face) => face.family === trimmed && face.weight === weight)) {
    return
  }
  faces.push({ family: trimmed, weight })
}

export function fontFacesFromXml(parts: string[]) {
  const faces: FontFace[] = []
  for (const source of parts) {
    if (!source.includes("rFonts") && !source.includes("latin")) continue
    const doc = xmlDoc(source)
    for (const latin of byLocal(doc, "latin")) {
      addFace(faces, latin.getAttribute("typeface") ?? "", "regular")
    }
    for (const fonts of byLocal(doc, "rFonts")) {
      addFace(faces, attr(fonts, "ascii"), "regular")
      addFace(faces, attr(fonts, "hAnsi"), "regular")
    }
  }
  return faces
}
