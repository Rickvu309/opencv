const LITERAL_PERSON = /\bpersonActor\(\s*["'`][^"'`]*["'`]\s*\)/g

export const MADE_UP_PERSON_HINT =
  "a person is someone who signed in; a read for someone who did not runs through registry.readAsVisitor"

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function madeUpPeople(source, fileName = "file.ts") {
  return [...String(source).matchAll(LITERAL_PERSON)].map(
    (match) =>
      `${fileName}:${lineOf(source, match.index)}: ${match[0]}; ${MADE_UP_PERSON_HINT}`
  )
}
