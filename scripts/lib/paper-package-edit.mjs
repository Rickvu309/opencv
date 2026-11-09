function lineOf(text, index) {
  return text.slice(0, Math.max(0, index)).split("\n").length
}

function problem(text, index = 0) {
  return { kind: "package-basis-lock", line: lineOf(text, index) }
}

function columns(block) {
  return [...block.matchAll(/column:\s*paperPackageHeads\.(\w+)/g)].map(
    (match) => match[1]
  )
}

function editProblems(text) {
  const problems = []
  const created = text.indexOf("createdAt")
  if (created !== -1) problems.push(problem(text, created))
  if (!text.includes('actor.type !== "person"')) problems.push(problem(text))
  const keys = [...text.matchAll(/key:\s*\[([\s\S]*?)\]/g)]
    .map((match) => match[1])
    .filter((block) => block.includes("column:"))
  if (keys.length !== 2) problems.push(problem(text))
  for (const block of keys) {
    if (columns(block).join(",") !== "docId,userId,incarnation")
      problems.push(problem(text, text.indexOf(block)))
  }
  const compared = [...text.matchAll(/compared:\s*\[([\s\S]*?)\]/g)]
  if (compared.length !== 2) problems.push(problem(text))
  const fields = []
  for (const block of compared) {
    const names = columns(block[1])
    const field = /field:\s*"([^"]+)"/.exec(block[1])?.[1] ?? ""
    fields.push(field)
    if (names.length !== 1 || names[0] !== "revision")
      problems.push(problem(text, block.index ?? 0))
  }
  if (!fields.includes("revision") || !fields.includes("parentRevision"))
    problems.push(problem(text))
  return problems
}

function restoreProblems(text) {
  const problems = []
  const readAt = text.indexOf("function readPackageHead")
  const compareAt = text.indexOf("function compareAndRestorePackage")
  if (readAt === -1 || compareAt === -1) return [problem(text)]
  const read = text.slice(readAt, compareAt)
  if (read.includes(".for(")) problems.push(problem(text, readAt))
  const updateAt = text.indexOf(".update(paperPackageHeads)")
  const setAt = text.indexOf(".set(", updateAt)
  const whereAt = text.indexOf(".where(", setAt)
  const returningAt = text.indexOf(".returning(", whereAt)
  if (updateAt === -1 || setAt === -1 || whereAt === -1 || returningAt === -1)
    return [problem(text)]
  const keys = [...text.slice(setAt, whereAt).matchAll(/(\w+):/g)].map(
    (match) => match[1]
  )
  if (keys.length !== 1 || keys[0] !== "revision")
    problems.push(problem(text, setAt))
  const where = text.slice(whereAt, returningAt)
  for (const name of ["userId", "docId", "incarnation", "revision"]) {
    if (!where.includes(`paperPackageHeads.${name}`))
      problems.push(problem(text, whereAt))
  }
  if (!text.includes("changed.length !== 1"))
    problems.push(problem(text, updateAt))
  return problems
}

export function detect(text, file = "source.ts") {
  const base = file.split("/").pop()
  if (base === "commands.ts")
    return text.includes("registerWordPackageEdit") ? [] : [problem(text)]
  if (base === "package-edit.ts") return editProblems(text)
  if (base === "package-restore.ts") return restoreProblems(text)
  return []
}
