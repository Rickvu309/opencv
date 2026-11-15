export function toBase64(bytes: Uint8Array): string {
  let text = ""
  for (let at = 0; at < bytes.length; at += 8192) {
    text += String.fromCharCode(...bytes.subarray(at, at + 8192))
  }
  return btoa(text)
}

export function fromBase64(text: string): Uint8Array {
  const raw = atob(text)
  const bytes = new Uint8Array(raw.length)
  for (let at = 0; at < raw.length; at += 1) bytes[at] = raw.charCodeAt(at)
  return bytes
}
