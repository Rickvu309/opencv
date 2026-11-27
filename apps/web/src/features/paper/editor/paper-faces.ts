import type { LayoutPage } from "@workspace/domain/paper-doc"

export type PaperFace = {
  family: string
  file: string
  weight: "400" | "700"
  style: "normal" | "italic"
}

const LIBERATION_VARIANTS = [
  ["Regular", "400", "normal"],
  ["Bold", "700", "normal"],
  ["Italic", "400", "italic"],
  ["BoldItalic", "700", "italic"],
] as const

export const PAPER_FACES: readonly PaperFace[] = [
  ...(["Sans", "Serif", "Mono"] as const).flatMap((kind) =>
    LIBERATION_VARIANTS.map(([variant, weight, style]) => ({
      family: `paper-liberation-${kind.toLowerCase()}`,
      file: `/fonts/Liberation${kind}-${variant}.ttf`,
      weight,
      style,
    }))
  ),
  {
    family: "paper-carlito",
    file: "/fonts/Carlito.ttf",
    weight: "400",
    style: "normal",
  },
]

export function faceStyle(face: string) {
  const variant = /-(bold-italic|bold|italic|regular)$/.exec(face)?.[1]
  const family = variant ? face.slice(0, -variant.length - 1) : face
  return {
    family: `paper-${family}`,
    weight: variant?.startsWith("bold") ? "700" : "400",
    style: variant?.endsWith("italic") ? "italic" : "normal",
  }
}

const faceId = (face: { family: string; weight: string; style: string }) =>
  `${face.family} ${face.weight} ${face.style}`

const registered = new Map<string, FontFace>()

export function registerPaperFaces() {
  if (registered.size > 0 || typeof FontFace !== "function") return registered
  for (const face of PAPER_FACES) {
    const font = new FontFace(
      face.family,
      `url("${face.file}") format("truetype")`,
      { weight: face.weight, style: face.style }
    )
    document.fonts.add(font)
    registered.set(faceId(face), font)
  }
  return registered
}

export function pageFaceKeys(pages: readonly LayoutPage[]) {
  const keys = new Set<string>()
  for (const page of pages)
    for (const box of page.boxes)
      if (box.kind === "line")
        for (const segment of box.segments) keys.add(segment.font)
  return keys
}

export function loadPageFaces(pages: readonly LayoutPage[]) {
  const faces = registerPaperFaces()
  for (const key of pageFaceKeys(pages)) {
    const style = faceStyle(key)
    const font =
      faces.get(faceId(style)) ??
      faces.get(faceId({ ...style, weight: "400", style: "normal" }))
    void font?.load().catch(() => null)
  }
}
