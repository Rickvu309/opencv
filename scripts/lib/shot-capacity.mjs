export function detect(source) {
  return /\breleaseUpload\s*\(/.test(source)
    ? ["Screenshot uploads bypass release capacity allocation"]
    : []
}
