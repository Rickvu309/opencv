const OPEN_SPACE = /[\s\p{P}]/u

const isWordCharacter = (character: string | undefined) =>
  character !== undefined && character !== "" && !OPEN_SPACE.test(character)

export type KeywordPlacement = { readonly skip: number; readonly text: string }

export function keywordPlacement(
  before: string,
  after: string,
  keyword: string
): KeywordPlacement {
  let skip = 0
  if (isWordCharacter(before.at(-1))) {
    while (skip < after.length && isWordCharacter(after[skip])) skip += 1
  }
  const left = skip > 0 ? after[skip - 1] : before.at(-1)
  const right = after[skip]
  const text = `${isWordCharacter(left) ? " " : ""}${keyword}${isWordCharacter(right) ? " " : ""}`
  return { skip, text }
}
