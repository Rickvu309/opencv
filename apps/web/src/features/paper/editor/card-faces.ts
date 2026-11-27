import type { FaceHeights } from "./painter.ts"

type Heights = { ascent: number; descent: number }

const SANS: Heights = { ascent: 905, descent: -212 }

const HEIGHTS_BY_FAMILY: Readonly<Record<string, Heights>> = {
  "liberation-sans": SANS,
  "liberation-serif": { ascent: 891, descent: -216 },
  "liberation-mono": { ascent: 833, descent: -300 },
  carlito: { ascent: 952, descent: -269 },
}

const VARIANT = /-(bold-italic|bold|italic|regular)$/

export const cardFaceHeights: FaceHeights = {
  face: (key) => HEIGHTS_BY_FAMILY[key.replace(VARIANT, "")] ?? SANS,
}
