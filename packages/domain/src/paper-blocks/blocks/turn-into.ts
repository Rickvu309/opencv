const PLAIN_TYPES = [
  "text",
  "heading",
  "bulleted-list",
  "numbered-list",
  "divider",
] as const

export function plainTurnInto(
  type: (typeof PLAIN_TYPES)[number]
): (typeof PLAIN_TYPES)[number][] {
  return PLAIN_TYPES.filter((item) => item !== type)
}
