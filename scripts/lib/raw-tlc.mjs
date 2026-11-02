const RAW_TLC = /tlc2\.TLC|tla2tools\.jar/

export function detectRawTlc(text) {
  return text
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((entry) => RAW_TLC.test(entry.text))
}
