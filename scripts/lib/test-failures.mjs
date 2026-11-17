export function failedGuards(result) {
  if (result.ok) return []
  const text = `${result.out}\n${result.err}`.replace(/\u001b\[[0-9;]*m/g, "")
  const cases = new Map()
  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const match = /^✖ (.+?) \(\d[\d.]*ms\)$/.exec(lines[i])
    if (!match) continue
    const detail = []
    for (
      let j = i + 1;
      j < lines.length &&
      (lines[j].trim() === "" || /^  \S|^   /.test(lines[j]));
      j++
    ) {
      if (/^\s+at |^\s+\}/.test(lines[j])) break
      if (lines[j].trim()) detail.push(lines[j].trim())
    }
    if (!cases.has(match[1]) || detail.length)
      cases.set(
        match[1],
        detail.length ? `${match[1]}: ${detail.join(" ")}` : match[1]
      )
  }
  const files = [...text.matchAll(/^FAIL (\S+)/gm)].map((m) => m[1])
  const found = [...new Set([...cases.values(), ...files])]
  if (found.length) return found
  return [
    `the guards exited without naming a test (${result.err || "no output"})`,
  ]
}
