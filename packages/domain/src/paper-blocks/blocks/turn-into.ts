import type { BlockType } from "../types.js"

const PLAIN_TYPES = [
  "text",
  "heading",
  "bulleted-list",
  "numbered-list",
  "divider",
] as const satisfies readonly BlockType[]

export function plainTurnInto(type: (typeof PLAIN_TYPES)[number]): BlockType[] {
  return PLAIN_TYPES.filter((item) => item !== type)
}
