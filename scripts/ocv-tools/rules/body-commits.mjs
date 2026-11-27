const namedCommit =
  /(?:`([0-9a-f]{7,40})`|(?:\b(?:at|on|head|commit)\s+|^\**Introduced by:\**\s*)\b([0-9a-f]{7,40})\b)/gi

export function commitFaults(lines, isReachable) {
  if (!isReachable) return []
  return lines.flatMap(({ line, number, code }) => {
    if (code) return []
    return [...line.matchAll(namedCommit)]
      .map((match) => match[1] ?? match[2])
      .filter((hash) => /[a-f]/i.test(hash) && /\d/.test(hash))
      .filter((hash) => !isReachable(hash.toLowerCase()))
      .map(
        (hash) =>
          `Line ${number} cites commit ${hash}, which is on neither this branch nor origin/main. Measure again at the head or drop the hash.`
      )
  })
}
