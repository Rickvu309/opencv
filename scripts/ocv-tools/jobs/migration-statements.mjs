const WORD_START = /[A-Za-z_]/
const WORD_PART = /[A-Za-z0-9_$]/
const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/

export class SqlParseError extends Error {}

function skipBlockComment(sql, at) {
  let depth = 1
  let i = at + 2
  while (i < sql.length && depth) {
    if (sql.startsWith("/*", i)) {
      depth += 1
      i += 2
    } else if (sql.startsWith("*/", i)) {
      depth -= 1
      i += 2
    } else i += 1
  }
  if (depth) throw new SqlParseError("a block comment never closes")
  return i
}

function endOfQuoted(sql, at, quote, backslash) {
  let i = at + 1
  while (i < sql.length) {
    if (backslash && sql[i] === "\\") i += 2
    else if (sql[i] === quote && sql[i + 1] === quote) i += 2
    else if (sql[i] === quote) return i + 1
    else i += 1
  }
  throw new SqlParseError(
    quote === "'" ? "a string never closes" : "a quoted name never closes"
  )
}

function endOfDollar(sql, at, tag) {
  const end = sql.indexOf(tag, at + tag.length)
  if (end < 0) throw new SqlParseError(`a ${tag} body never closes`)
  return end + tag.length
}

export function tokenize(sql) {
  const text = String(sql ?? "")
  const tokens = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) i += 1
    else if (text.startsWith("--", i)) {
      const end = text.indexOf("\n", i)
      i = end < 0 ? text.length : end + 1
    } else if (text.startsWith("/*", i)) i = skipBlockComment(text, i)
    else if (c === "'") {
      const prev = tokens.at(-1)
      const escaped = prev?.t === "word" && prev.v === "E" && prev.end === i
      if (escaped) tokens.pop()
      const end = endOfQuoted(text, i, "'", escaped)
      tokens.push({ t: "str", start: escaped ? prev.start : i, end })
      i = end
    } else if (c === '"') {
      const end = endOfQuoted(text, i, '"', false)
      tokens.push({
        t: "name",
        v: text.slice(i + 1, end - 1).replace(/""/g, '"'),
        start: i,
        end,
      })
      i = end
    } else if (c === "$" && DOLLAR_TAG.test(text.slice(i, i + 64))) {
      const tag = text.slice(i).match(DOLLAR_TAG)[0]
      const end = endOfDollar(text, i, tag)
      tokens.push({ t: "str", start: i, end })
      i = end
    } else if (WORD_START.test(c)) {
      let end = i + 1
      while (end < text.length && WORD_PART.test(text[end])) end += 1
      const raw = text.slice(i, end)
      tokens.push({ t: "word", v: raw.toUpperCase(), raw, start: i, end })
      i = end
    } else {
      tokens.push({ t: "punct", v: c, start: i, end: i + 1 })
      i += 1
    }
  }
  return tokens
}

export function splitStatements(sql) {
  const text = String(sql ?? "")
  const statements = []
  let current = []
  for (const token of tokenize(text)) {
    if (token.t === "punct" && token.v === ";") {
      if (current.length) statements.push(current)
      current = []
    } else current.push(token)
  }
  if (current.length) statements.push(current)
  return statements.map((tokens) => ({
    tokens,
    text: text
      .slice(tokens[0].start, tokens.at(-1).end)
      .replace(/\s+/g, " ")
      .trim(),
  }))
}

const isName = (token) => token?.t === "word" || token?.t === "name"
const part = (token) =>
  token.t === "name" ? token.v.toLowerCase() : token.raw.toLowerCase()

function nameAt(ts, i) {
  if (!isName(ts[i])) return [null, i]
  const parts = [part(ts[i])]
  let j = i + 1
  while (ts[j]?.t === "punct" && ts[j].v === "." && isName(ts[j + 1])) {
    parts.push(part(ts[j + 1]))
    j += 2
  }
  return [parts.join("."), j]
}

function words(ts, i, ...expected) {
  for (const [k, word] of expected.entries())
    if (ts[i + k]?.t !== "word" || ts[i + k].v !== word) return -1
  return i + expected.length
}

const optional = (ts, i, ...expected) => {
  const j = words(ts, i, ...expected)
  return j < 0 ? i : j
}

function closeOf(ts, open) {
  let depth = 0
  for (let i = open; i < ts.length; i++) {
    if (ts[i].t !== "punct") continue
    if (ts[i].v === "(") depth += 1
    if (ts[i].v === ")" && --depth === 0) return i
  }
  return -1
}

function topLevelParts(ts, from) {
  const parts = [[]]
  let depth = 0
  for (const token of ts.slice(from)) {
    if (token.t === "punct" && token.v === "(") depth += 1
    if (token.t === "punct" && token.v === ")") depth -= 1
    if (token.t === "punct" && token.v === "," && depth === 0) parts.push([])
    else parts.at(-1).push(token)
  }
  return parts
}

const parent = (name) => name.split(".").slice(0, -1).join(".")

function createTable(ts, made) {
  let i = words(ts, 0, "CREATE", "TABLE")
  if (i < 0) return null
  const ifNot = words(ts, i, "IF", "NOT", "EXISTS")
  const [name, j] = nameAt(ts, ifNot < 0 ? i : ifNot)
  if (!name || ts[j]?.v !== "(")
    return "CREATE TABLE without a column list (AS, PARTITION OF or OF) is not on the only-adds list"
  if (closeOf(ts, j) !== ts.length - 1)
    return "CREATE TABLE with options after its columns (INHERITS, PARTITION BY, WITH) is not on the only-adds list"
  if (ifNot < 0) made.tables.add(name)
  return true
}

function createIndex(ts, made) {
  let i = words(ts, 0, "CREATE")
  if (i < 0) return null
  i = optional(ts, i, "UNIQUE")
  i = words(ts, i, "INDEX")
  if (i < 0) return null
  const concurrently = words(ts, i, "CONCURRENTLY") >= 0
  i = optional(ts, i, "CONCURRENTLY")
  i = optional(ts, i, "IF", "NOT", "EXISTS")
  let index = null
  if (words(ts, i, "ON") < 0) [index, i] = nameAt(ts, i)
  i = words(ts, i, "ON")
  if (i < 0) return "a CREATE INDEX the scanner cannot read"
  i = optional(ts, i, "ONLY")
  const [table] = nameAt(ts, i)
  if (table && made.tables.has(table)) {
    if (index) made.indexes.add(index)
    if (index && !index.includes(".") && table.includes("."))
      made.indexes.add(`${parent(table)}.${index}`)
    return true
  }
  return concurrently
    ? `an index on ${table}, a table this migration did not create, builds over its existing rows`
    : `an index on ${table}, a table this migration did not create, locks its writes while it builds (no CONCURRENTLY)`
}

function alterTable(ts, made) {
  let i = words(ts, 0, "ALTER", "TABLE")
  if (i < 0) return null
  i = optional(ts, i, "IF", "EXISTS")
  i = optional(ts, i, "ONLY")
  const [table, j] = nameAt(ts, i)
  if (!table || !made.tables.has(table))
    return `an ALTER TABLE on ${table}, a table this migration did not create`
  const odd = topLevelParts(ts, j).find(
    (action) =>
      !(action[0]?.t === "word" && action[0].v === "ADD" && isName(action[1]))
  )
  if (odd)
    return `an ALTER TABLE action other than ADD COLUMN or ADD CONSTRAINT (${odd
      .slice(0, 3)
      .map((t) => t.raw ?? t.v)
      .join(" ")})`
  return true
}

function createSmall(ts, made) {
  if (words(ts, 0, "CREATE", "TYPE") >= 0) {
    const [name] = nameAt(ts, 2)
    if (name) made.types.add(name)
    return true
  }
  const schema = words(ts, 0, "CREATE", "SCHEMA", "IF", "NOT", "EXISTS")
  if (schema >= 0) {
    const [name, j] = nameAt(ts, schema)
    return name && j === ts.length
      ? (made.schemas.add(name), true)
      : "CREATE SCHEMA with AUTHORIZATION or elements is not on the only-adds list"
  }
  let i = words(ts, 0, "CREATE", "SEQUENCE")
  if (i < 0) return null
  i = optional(ts, i, "IF", "NOT", "EXISTS")
  const [name] = nameAt(ts, i)
  const owned = ts.findIndex((t, k) => t.v === "OWNED" && ts[k + 1]?.v === "BY")
  if (owned >= 0) {
    const [column] = nameAt(ts, owned + 2)
    if (column !== "none" && !made.tables.has(parent(column ?? "")))
      return `a sequence OWNED BY ${column}, a column of a table this migration did not create`
  }
  if (name) made.sequences.add(name)
  return true
}

const COMMENT_KINDS = {
  TABLE: (made, name) => made.tables.has(name),
  COLUMN: (made, name) => made.tables.has(parent(name)),
  INDEX: (made, name) => made.indexes.has(name),
  TYPE: (made, name) => made.types.has(name),
  SEQUENCE: (made, name) => made.sequences.has(name),
  SCHEMA: (made, name) => made.schemas.has(name),
}

function commentOn(ts, made) {
  const i = words(ts, 0, "COMMENT", "ON")
  if (i < 0) return null
  const kind = ts[i]?.v
  const [name] = nameAt(ts, i + 1)
  const own = COMMENT_KINDS[kind]
  return own && name && own(made, name)
    ? true
    : `a COMMENT ON ${kind} ${name}, which this migration did not create`
}

const REFUSED = [
  [["UPDATE"], "an UPDATE changes existing rows"],
  [["DELETE"], "a DELETE removes existing rows"],
  [["TRUNCATE"], "a TRUNCATE empties a table"],
  [["MERGE"], "a MERGE changes existing rows"],
  [["DROP"], "a DROP removes what exists"],
  [["GRANT"], "a GRANT changes who can reach what exists"],
  [["REVOKE"], "a REVOKE changes who can reach what exists"],
  [["DO"], "a DO block runs code against the database"],
  [["CREATE", "OR", "REPLACE"], "CREATE OR REPLACE replaces what may exist"],
  [
    ["CREATE", "POLICY"],
    "a row-level policy changes who can read or write rows",
  ],
  [["CREATE", "TRIGGER"], "a trigger runs code on writes to a table"],
  [["CREATE", "FUNCTION"], "a function is code the database runs"],
  [["ALTER"], "an ALTER changes something that exists"],
]

function refusedReason(ts) {
  if (words(ts, 0, "INSERT") >= 0) {
    const upsert = ts.some((t, k) => t.v === "DO" && ts[k + 1]?.v === "UPDATE")
    return upsert
      ? "an upsert (INSERT ... ON CONFLICT DO UPDATE) changes existing rows"
      : "an INSERT writes rows"
  }
  const hit = REFUSED.find(([lead]) => words(ts, 0, ...lead) >= 0)
  if (hit) return hit[1]
  const lead = ts
    .slice(0, 2)
    .map((t) => t.raw ?? t.v)
    .join(" ")
  return `${lead} is not on the only-adds list`
}

const CLASSIFIERS = [
  createTable,
  createIndex,
  alterTable,
  createSmall,
  commentOn,
]

export function classifyMigration(sql) {
  let statements
  try {
    statements = splitStatements(sql)
  } catch (error) {
    if (!(error instanceof SqlParseError)) throw error
    return {
      onlyAdds: false,
      statements: 0,
      first: {
        n: 0,
        text: "",
        why: `the scanner cannot parse it: ${error.message}`,
      },
    }
  }
  const made = {
    tables: new Set(),
    indexes: new Set(),
    types: new Set(),
    schemas: new Set(),
    sequences: new Set(),
  }
  for (const [k, statement] of statements.entries()) {
    let verdict = null
    for (const classify of CLASSIFIERS) {
      verdict = classify(statement.tokens, made)
      if (verdict !== null) break
    }
    if (verdict === true) continue
    return {
      onlyAdds: false,
      statements: statements.length,
      first: {
        n: k + 1,
        text: statement.text,
        why: verdict ?? refusedReason(statement.tokens),
      },
    }
  }
  return { onlyAdds: true, statements: statements.length, first: null }
}
