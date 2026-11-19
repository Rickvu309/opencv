const RECOLOUR_KEYED_ON_SIZE =
  /svg:not\(\[class\*=['"]?size-['"]?\]\)\]:text-[\w-]+/g

export function iconRecolourKeyedOnSize(source) {
  const lines = source.split("\n")
  return lines.flatMap((text, index) =>
    [...text.matchAll(RECOLOUR_KEYED_ON_SIZE)].map((match) => ({
      line: index + 1,
      selector: match[0],
    }))
  )
}
