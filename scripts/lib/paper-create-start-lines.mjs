const CREATE_SERVER = /^apps\/api\/src\/paper\/operations\/create\/server\.ts$/
const STARTS_LOG = /\b(?:engineLog\.start|createPaper)\(/g
const READS_TEMPLATE = /\btemplateLines\(/
const READS_DRAFTED = /\binput\.lines\b/

function argumentsAt(source, open) {
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === "(") depth += 1
    if (char === ")") {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }
  return source.slice(open + 1)
}

export function detect(source, file) {
  if (!CREATE_SERVER.test(file)) return []
  const starts = [...source.matchAll(STARTS_LOG)].map((match) =>
    argumentsAt(source, match.index + match[0].length - 1)
  )
  if (starts.length === 0) return []
  const problems = []
  if (starts.some((args) => /\bpaperEngineBlank\./.test(args)))
    problems.push(
      `${file} starts a new Paper's log from a blank page, so drafted lines and templates are dropped`
    )
  if (!READS_TEMPLATE.test(source))
    problems.push(
      `${file} starts a new Paper's log without templateLines, so a template CV opens blank`
    )
  if (!READS_DRAFTED.test(source))
    problems.push(
      `${file} starts a new Paper's log without input.lines, so a drafted Letter opens blank`
    )
  return problems
}
