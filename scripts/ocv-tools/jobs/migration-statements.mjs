const WORD_START = /[A-Za-z_]/
const WORD_PART = /[A-Za-z0-9_$]/
const DOLLAR_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y
const SQL_SPACE = /[ \t\n\r\f\v]/
const SQL_PUNCT = new Set("(),;.=:[]+-*/<>%^|&!~@#")
export const APP_SCHEMA = "opencv_app"

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

function dollarTagAt(text, at) {
  DOLLAR_TAG.lastIndex = at
  const match = DOLLAR_TAG.exec(text)
  return match ? match[0] : null
}

export function tokenize(sql) {
  const text = String(sql ?? "")
  const tokens = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (SQL_SPACE.test(c)) i += 1
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
    } else if (
      /[Uu]/.test(c) &&
      text[i + 1] === "&" &&
      /["']/.test(text[i + 2] ?? "")
    ) {
      const end = endOfQuoted(text, i + 2, text[i + 2], false)
      tokens.push({
        t: "unread",
        v: "a Unicode-escaped name or string (U&)",
        start: i,
        end,
      })
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
    } else if (c === "$" && dollarTagAt(text, i)) {
      const tag = dollarTagAt(text, i)
      const end = endOfDollar(text, i, tag)
      tokens.push({ t: "str", start: i, end })
      i = end
    } else if (/[0-9]/.test(c)) {
      let end = i + 1
      while (end < text.length && /[0-9A-Za-z_.]/.test(text[end])) end += 1
      tokens.push({ t: "num", v: text.slice(i, end), start: i, end })
      i = end
    } else if (WORD_START.test(c)) {
      let end = i + 1
      while (end < text.length && WORD_PART.test(text[end])) end += 1
      const raw = text.slice(i, end)
      tokens.push({ t: "word", v: raw.toUpperCase(), raw, start: i, end })
      i = end
    } else if (!SQL_PUNCT.has(c)) {
      tokens.push({
        t: "unread",
        v: `the character ${JSON.stringify(c)} outside quotes (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`,
        start: i,
        end: i + 1,
      })
      i += 1
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
const part = (token) => (token.t === "name" ? token.v : token.raw.toLowerCase())
const PLAIN = /^[a-z_][a-z0-9_$]*$/
const keyOf = (parts) => (parts ? JSON.stringify(parts) : null)
const show = (parts) =>
  parts
    ? parts
        .map((p) => (PLAIN.test(p) ? p : `"${p.replace(/"/g, '""')}"`))
        .join(".")
    : "a name the scanner cannot read"
const parentOf = (parts) => (parts ? parts.slice(0, -1) : null)
const inApp = (parts) => parts?.length === 2 && parts[0] === APP_SCHEMA
const notInApp = (what, parts) =>
  `${what} ${show(parts)} is not schema-qualified to ${APP_SCHEMA}, so Postgres may resolve it to an object that already exists (pg_catalog is searched first)`

function nameAt(ts, i) {
  if (!isName(ts[i])) return [null, i]
  const parts = [part(ts[i])]
  let j = i + 1
  while (ts[j]?.t === "punct" && ts[j].v === "." && isName(ts[j + 1])) {
    parts.push(part(ts[j + 1]))
    j += 2
  }
  return [parts, j]
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

function createTable(ts, made) {
  let i = words(ts, 0, "CREATE", "TABLE")
  if (i < 0) return null
  const ifNot = words(ts, i, "IF", "NOT", "EXISTS")
  const [name, j] = nameAt(ts, ifNot < 0 ? i : ifNot)
  if (!name || ts[j]?.v !== "(")
    return "CREATE TABLE without a column list (AS, PARTITION OF or OF) is not on the only-adds list"
  if (closeOf(ts, j) !== ts.length - 1)
    return "CREATE TABLE with options after its columns (INHERITS, PARTITION BY, WITH) is not on the only-adds list"
  if (!inApp(name)) return notInApp("the table", name)
  if (ifNot < 0) made.tables.add(keyOf(name))
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
  const ifNot = words(ts, i, "IF", "NOT", "EXISTS") >= 0
  i = optional(ts, i, "IF", "NOT", "EXISTS")
  let index = null
  if (words(ts, i, "ON") < 0) [index, i] = nameAt(ts, i)
  i = words(ts, i, "ON")
  if (i < 0) return "a CREATE INDEX the scanner cannot read"
  i = optional(ts, i, "ONLY")
  const [table] = nameAt(ts, i)
  if (table && made.tables.has(keyOf(table))) {
    if (index && !ifNot && index.length === 1)
      made.indexes.add(keyOf([...parentOf(table), ...index]))
    return true
  }
  return concurrently
    ? `an index on ${show(table)}, a table this migration did not create, builds over its existing rows`
    : `an index on ${show(table)}, a table this migration did not create, locks its writes while it builds (no CONCURRENTLY)`
}

function alterTable(ts, made) {
  let i = words(ts, 0, "ALTER", "TABLE")
  if (i < 0) return null
  i = optional(ts, i, "IF", "EXISTS")
  i = optional(ts, i, "ONLY")
  const [table, j] = nameAt(ts, i)
  if (!table || !made.tables.has(keyOf(table)))
    return `an ALTER TABLE on ${show(table)}, a table this migration did not create`
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
    const [name, j] = nameAt(ts, 2)
    if (!enumBody(ts, j))
      return "a CREATE TYPE other than AS ENUM ('label', ...) is not on the only-adds list"
    if (!inApp(name)) return notInApp("the type", name)
    made.types.add(keyOf(name))
    return true
  }
  const schema = words(ts, 0, "CREATE", "SCHEMA", "IF", "NOT", "EXISTS")
  if (schema >= 0) {
    const [name, j] = nameAt(ts, schema)
    if (!name || j !== ts.length)
      return "CREATE SCHEMA with AUTHORIZATION or elements is not on the only-adds list"
    return name.length === 1 && name[0] === APP_SCHEMA
      ? true
      : `CREATE SCHEMA ${show(name)} is not the app schema ${APP_SCHEMA}`
  }
  let i = words(ts, 0, "CREATE", "SEQUENCE")
  if (i < 0) return null
  const ifNot = words(ts, i, "IF", "NOT", "EXISTS") >= 0
  i = optional(ts, i, "IF", "NOT", "EXISTS")
  const [name] = nameAt(ts, i)
  const owned = ts.findIndex(
    (t, k) =>
      t.t === "word" &&
      t.v === "OWNED" &&
      ts[k + 1]?.t === "word" &&
      ts[k + 1].v === "BY"
  )
  if (owned >= 0) {
    const [column] = nameAt(ts, owned + 2)
    const none = ts[owned + 2]?.t === "word" && ts[owned + 2].v === "NONE"
    if (!none && !made.tables.has(keyOf(parentOf(column))))
      return `a sequence OWNED BY ${show(column)}, a column of a table this migration did not create`
  }
  if (!inApp(name)) return notInApp("the sequence", name)
  if (!ifNot) made.sequences.add(keyOf(name))
  return true
}

function enumBody(ts, j) {
  if (words(ts, j, "AS", "ENUM") < 0 || ts[j + 2]?.v !== "(") return false
  if (closeOf(ts, j + 2) !== ts.length - 1) return false
  const items = topLevelParts(ts.slice(j + 3, -1), 0)
  return items.every((item) => item.length === 1 && item[0].t === "str")
}

const COMMENT_KINDS = {
  TABLE: (made, name) => made.tables.has(keyOf(name)),
  COLUMN: (made, name) => made.tables.has(keyOf(parentOf(name))),
  INDEX: (made, name) => made.indexes.has(keyOf(name)),
  TYPE: (made, name) => made.types.has(keyOf(name)),
  SEQUENCE: (made, name) => made.sequences.has(keyOf(name)),
}

function commentOn(ts, made) {
  const i = words(ts, 0, "COMMENT", "ON")
  if (i < 0) return null
  const kind = ts[i]?.v
  const [name, j] = nameAt(ts, i + 1)
  const own = COMMENT_KINDS[kind]
  const text = ts[j + 1]
  const whole =
    words(ts, j, "IS") >= 0 &&
    j + 2 === ts.length &&
    (text?.t === "str" || (text?.t === "word" && text.v === "NULL"))
  if (!(own && name && own(made, name)))
    return `a COMMENT ON ${kind} ${show(name)}, which this migration did not create`
  return whole
    ? true
    : "a COMMENT ON that is not exactly IS followed by one string is not on the only-adds list"
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
  if (!statements.length)
    return {
      onlyAdds: false,
      statements: 0,
      first: {
        n: 0,
        text: "",
        why: "it has no statements, so the scanner cannot tell what it is for; a migration with nothing to run is usually a file cut short",
      },
    }
  const made = {
    tables: new Set(),
    indexes: new Set(),
    types: new Set(),
    sequences: new Set(),
  }
  const kinds = []
  for (const [k, statement] of statements.entries()) {
    const unread = statement.tokens.find((token) => token.t === "unread")
    let verdict = unread
      ? `it holds ${unread.v}, which the scanner does not read`
      : null
    for (const classify of unread ? [] : CLASSIFIERS) {
      verdict = classify(statement.tokens, made)
      if (verdict !== null) break
    }
    if (verdict === true) {
      kinds.push(kindOf(statement.tokens))
      continue
    }
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
  return {
    onlyAdds: true,
    statements: statements.length,
    first: null,
    kinds: kindCounts(kinds),
  }
}

function kindOf(ts) {
  if (words(ts, 0, "CREATE", "UNIQUE", "INDEX") >= 0) return "CREATE INDEX"
  if (words(ts, 0, "ALTER", "TABLE") >= 0) return "ALTER TABLE of a new table"
  return `${ts[0].v} ${ts[1]?.v ?? ""}`.trim()
}

function kindCounts(kinds) {
  const counts = new Map()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts].map(([kind, n]) => `${n} ${kind}`).join(", ")
}
