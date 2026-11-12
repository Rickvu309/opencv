export class UsageError extends Error {}

export function parseArgs(
  argv,
  { valued = [], repeated = [], switches = [] } = {}
) {
  const positional = []
  const flags = {}
  const known = new Set([...valued, ...repeated, ...switches])
  for (let at = 0; at < argv.length; at += 1) {
    const token = argv[at]
    if (!token.startsWith("--")) {
      positional.push(token)
      continue
    }
    const [rawName, inline] = token.slice(2).split(/=(.*)/s)
    if (!known.has(rawName)) throw new UsageError(`unknown option --${rawName}`)
    if (switches.includes(rawName)) {
      flags[rawName] = true
      continue
    }
    const value = inline ?? argv[(at += 1)]
    if (value === undefined || value.startsWith("--"))
      throw new UsageError(`--${rawName} needs a value`)
    if (repeated.includes(rawName))
      flags[rawName] = [...(flags[rawName] ?? []), ...value.split(",")]
    else flags[rawName] = value
  }
  return { positional, flags }
}

export function positiveIntegers(values, name) {
  return values.map((value) => {
    const number = Number(value)
    if (!Number.isInteger(number) || number <= 0)
      throw new UsageError(
        `${name} takes whole numbers above zero, got ${value}`
      )
    return number
  })
}
