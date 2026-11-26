const NAMED_IN_CODE =
  /`([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)(?:\.[a-z][a-zA-Z0-9]*)?`/g

export function namedIdentifiers(doc) {
  return [...new Set([...doc.matchAll(NAMED_IN_CODE)].map((match) => match[1]))]
}

export function undeclaredNames(doc, sources) {
  return namedIdentifiers(doc).filter(
    (name) =>
      !sources.some((source) =>
        new RegExp(`\\b(function|const|let|var|class)\\s+${name}\\b`).test(
          source
        )
      )
  )
}
