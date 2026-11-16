export function detect(text, path = "") {
  if (
    !/packages\/paper-crdt\/src\/(?:native-layout|editor)-search\.ts$/.test(
      path
    )
  )
    return []
  const source = String(text)
  const hits = []
  const add = (at, message) =>
    hits.push({ line: source.slice(0, at).split("\n").length, text: message })
  const matcher = source.indexOf("export function paperSearchMatches")
  const replacement = source.indexOf("function replacement", matcher)
  const search = source.slice(matcher, replacement)
  const segment = search.indexOf("graphemes.segment(")
  if (matcher >= 0 && segment >= 0)
    add(
      matcher + segment,
      "Search must reuse the index for unchanged text blocks"
    )
  if (
    matcher >= 0 &&
    /const needle\s*=/.test(search) &&
    !/normalizedIndex\(query,\s*matchCase\)\.text/.test(search)
  )
    add(matcher, "Query and document must use the same normalized index")
  const replace = source.indexOf("replace(text: string, all: boolean)")
  const body = source.slice(replace, source.indexOf("destroy()", replace))
  if (replace >= 0 && !/kind:\s*"replace"[\s\S]*?after:/.test(body))
    add(replace, "Single Replace must advance from the end of its replacement")
  if (
    source.includes("tr.mapping.map(old.from)") &&
    !source.includes("relativePositionToAbsolutePosition(")
  )
    add(
      source.indexOf("tr.mapping.map(old.from)"),
      "Current matches need a relative position across Yjs whole-document transactions"
    )
  return hits
}
