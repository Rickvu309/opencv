const API_SOURCE = /^apps\/api\/src\/.+\.ts$/
const TEST_SOURCE = /(\.test\.ts|\.test-support\.ts|\/test\/[^/]+\.ts)$/
const INSERTS_PAPER = /\.insert\(\s*paperDocs\s*\)/g
const NAMED_FUNCTION = /\bfunction\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g
const STARTS_LOG = /\bengineLog\.start\(/

function closing(source, open, opener, closer) {
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === opener) depth += 1
    if (source[index] === closer) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return source.length
}

function functions(source) {
  return [...source.matchAll(NAMED_FUNCTION)].map((match) => {
    const params = match.index + match[0].length - 1
    const afterParams = closing(source, params, "(", ")")
    const open = source.indexOf("{", afterParams)
    const end = open < 0 ? source.length : closing(source, open, "{", "}")
    return {
      name: match[1],
      start: match.index,
      end,
      body: source.slice(open, end),
    }
  })
}

export function detect(source, file) {
  if (!API_SOURCE.test(file) || TEST_SOURCE.test(file)) return []
  const declared = functions(source)
  const problems = []
  for (const insert of source.matchAll(INSERTS_PAPER)) {
    const owner = declared
      .filter((fn) => fn.start < insert.index && insert.index < fn.end)
      .sort((left, right) => right.start - left.start)[0]
    const scope = owner ? owner.body : source
    if (STARTS_LOG.test(scope)) continue
    problems.push(
      `${file} inserts a Paper row in ${owner ? owner.name : "module scope"} without engineLog.start, so the new Paper is engine 1 and the page cannot open it`
    )
  }
  return problems
}
