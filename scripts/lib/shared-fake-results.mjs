export function detect(source) {
  return source
    .split("\n")
    .flatMap((line, index) =>
      /\bPR_RESULT_DIR\s*:.*(?:["'`]\/|join\(tmpdir\(\))/.test(line)
        ? [index + 1]
        : []
    )
}
