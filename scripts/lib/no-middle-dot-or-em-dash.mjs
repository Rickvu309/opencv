const BANNED_PUNCTUATION = /[\u00B7\u2014]/u

export function bannedPunctuationLines(source, file) {
  return source
    .split(/\r\n?|\n/)
    .flatMap((line, index) =>
      BANNED_PUNCTUATION.test(line) ? [`${file}:${index + 1}`] : []
    )
}
