const NUMBER = /^(\d{4})_/
const SQL = /^(\d{4}_.+)\.sql$/
const SNAPSHOT = /^(\d{4})_snapshot\.json$/

const numberOf = (tag) => NUMBER.exec(tag)?.[1] ?? null

export function journalProblems(entries) {
  const problems = []
  const seenIdx = new Map()
  const seenNumber = new Map()
  let previous = null
  for (const entry of entries) {
    const number = numberOf(entry.tag)
    if (seenIdx.has(entry.idx))
      problems.push(
        `idx ${entry.idx} is used by ${seenIdx.get(entry.idx)} and ${entry.tag}: renumber the newer migration after the last one on main`
      )
    seenIdx.set(entry.idx, entry.tag)
    if (number && seenNumber.has(number))
      problems.push(
        `number ${number} is used by ${seenNumber.get(number)} and ${entry.tag}: renumber the newer migration after the last one on main`
      )
    if (number) seenNumber.set(number, entry.tag)
    if (number && Number(number) !== entry.idx)
      problems.push(
        `${entry.tag} has idx ${entry.idx}; its number says ${Number(number)}`
      )
    if (previous && entry.idx <= previous.idx)
      problems.push(
        `${entry.tag} (idx ${entry.idx}) comes after idx ${previous.idx}; the journal must run in idx order`
      )
    if (previous && entry.when <= previous.when)
      problems.push(
        `${entry.tag} has when ${entry.when}, not later than ${previous.tag} (${previous.when}); production skips a migration older than the last one it ran, with no error. Give it a when after ${previous.when}`
      )
    previous = entry
  }
  return problems
}

export function fileProblems(entries, sqlFiles, snapshots) {
  const problems = []
  const tags = new Set(entries.map((entry) => entry.tag))
  const sqlTags = new Set(
    sqlFiles.map((name) => SQL.exec(name)?.[1]).filter(Boolean)
  )
  for (const tag of sqlTags)
    if (!tags.has(tag))
      problems.push(`${tag}.sql has no journal entry, so it never runs`)
  for (const tag of tags)
    if (!sqlTags.has(tag))
      problems.push(`journal entry ${tag} has no ${tag}.sql`)
  const chain = Object.entries(snapshots)
    .map(([name, snapshot]) => ({
      number: SNAPSHOT.exec(name)?.[1],
      ...snapshot,
    }))
    .filter((item) => item.number)
    .sort((a, b) => a.number.localeCompare(b.number))
  const ids = new Map()
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i]
    if (ids.has(item.id))
      problems.push(
        `snapshot ${item.number} reuses the id of snapshot ${ids.get(item.id)}`
      )
    ids.set(item.id, item.number)
    if (i > 0 && item.prevId !== chain[i - 1].id)
      problems.push(
        `snapshot ${item.number} links to ${item.prevId}, not to snapshot ${chain[i - 1].number} (${chain[i - 1].id}); regenerate it after the last migration on main`
      )
  }
  return problems
}

export function detect(journalText) {
  const parsed = JSON.parse(journalText)
  return journalProblems(
    (parsed.entries ?? []).map(({ idx, when, tag }) => ({ idx, when, tag }))
  )
}
