const lineEndings = (text) => text?.replace(/\r\n?/g, "\n")

export const generatedDirectories = (expected) => [
  ...new Set(
    Object.keys(expected).map((file) => file.slice(0, file.lastIndexOf("/")))
  ),
]

export const staleFiles = (expected, current) => [
  ...Object.entries(expected)
    .filter(([file, content]) => lineEndings(current[file]) !== content)
    .map(([file]) => file),
  ...Object.keys(current).filter((file) => !(file in expected)),
]

export function detect(text) {
  const { expected, current } = JSON.parse(text)
  return staleFiles(expected, current)
}
