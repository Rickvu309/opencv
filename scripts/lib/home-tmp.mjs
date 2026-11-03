const HOME = /process\.env\.HOME\b|\bhomedir\s*\(/
const TMP = /["'`]tmp["'`]/

export function detect(text) {
  const hits = []
  String(text ?? "")
    .split("\n")
    .forEach((line, index) => {
      if (HOME.test(line) && TMP.test(line)) hits.push(index + 1)
    })
  return hits
}
