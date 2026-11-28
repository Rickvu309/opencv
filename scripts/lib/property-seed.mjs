const HELD = /^packages\/paper-(?:crdt|engine)\/src\/.*\.test\.tsx?$/
const PROPERTY_RUN = /\bfc\.(assert|check)\(/g
const RANDOM_DOCUMENT = /\bnew Y\.Doc\(/
const PINNED_DOCUMENT = /\.clientID = /

export function detect(text, file) {
  if (!HELD.test(String(file))) return []
  const source = String(text)
  const runs = [...source.matchAll(PROPERTY_RUN)]
  if (!runs.length) return []
  const hits = []
  const seeds = (source.match(/\bseed: /g) ?? []).length
  if (seeds < runs.length)
    hits.push(
      `${runs.length - seeds} property run(s) draw a new random seed on every run; pass a fixed seed so the same commit gives the same result`
    )
  if (RANDOM_DOCUMENT.test(source) && !PINNED_DOCUMENT.test(source))
    hits.push(
      "the property builds documents with random ids, and the order of two writers' ids decides how their edits merge; set clientID on each document"
    )
  return hits
}
