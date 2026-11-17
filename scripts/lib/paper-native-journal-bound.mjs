export function detectGrowingNativeJournal(source) {
  const start = source.indexOf("export function appendNativeJournal(")
  if (start === -1)
    return [
      "appendNativeJournal is missing, so the journal bound cannot be read",
    ]
  const next = source.indexOf("\nexport ", start + 1)
  const body = source.slice(start, next === -1 ? source.length : next)
  if (
    /\.\.\.\s*[\w.]+\.entries\b/.test(body) ||
    /\.entries\.concat\(/.test(body)
  )
    return [
      "appendNativeJournal keeps every earlier snapshot, so holding a key fills localStorage and the page refuses its own typing",
    ]
  return []
}
