export type FontFacts = {
  weightMin: number
  weightMax: number
  italic: boolean
  copyright: string
}

function u16(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  )
}

function tag(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!
  )
}

function table(bytes: Uint8Array, name: string) {
  const count = u16(bytes, 4)
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16
    if (tag(bytes, at) !== name) continue
    const start = u32(bytes, at + 8)
    const length = u32(bytes, at + 12)
    return bytes.subarray(start, start + length)
  }
  return null
}

function characters(bytes: Uint8Array, platform: number) {
  if (platform === 0 || platform === 3) {
    let value = ""
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      value += String.fromCharCode((bytes[index]! << 8) | bytes[index + 1]!)
    }
    return value.replace(/\0/g, "").trim()
  }
  return new TextDecoder("latin1").decode(bytes).replace(/\0/g, "").trim()
}

export function fontFacts(bytes: Uint8Array): FontFacts {
  const os2 = table(bytes, "OS/2")
  const name = table(bytes, "name")
  const fvar = table(bytes, "fvar")
  const head = table(bytes, "head")
  if (!os2 || !name || os2.length < 64) throw new Error("Not a font file")
  let weightMin = u16(os2, 4)
  let weightMax = weightMin
  let italic = (u16(os2, 62) & 1) !== 0 || (u16(os2, 62) & 512) !== 0
  if (head && head[45] !== undefined && (u16(head, 44) & 2) !== 0) italic = true
  if (fvar && fvar[15] !== undefined && u16(fvar, 0) === 1) {
    const axesAt = u16(fvar, 4)
    const axisCount = u16(fvar, 8)
    const axisSize = u16(fvar, 10) || 20
    for (let index = 0; index < axisCount; index++) {
      const at = axesAt + index * axisSize
      if (at + 16 > fvar.length) break
      const axis = tag(fvar, at)
      if (axis === "ital" || axis === "slnt") italic = true
      if (axis !== "wght") continue
      weightMin = u32(fvar, at + 4) / 65536
      weightMax = u32(fvar, at + 12) / 65536
    }
  }
  const count = u16(name, 2)
  const stringOffset = u16(name, 4)
  let copyright = ""
  let fallback = ""
  for (let index = 0; index < count; index++) {
    const at = 6 + index * 12
    if (at + 12 > name.length) break
    if (u16(name, at + 6) !== 0) continue
    const length = u16(name, at + 8)
    const offset = u16(name, at + 10)
    const raw = name.subarray(
      stringOffset + offset,
      stringOffset + offset + length
    )
    const text = characters(raw, u16(name, at))
    if (!text) continue
    fallback ||= text
    if (u16(name, at) === 3 && u16(name, at + 4) === 0x409) copyright = text
  }
  return {
    weightMin,
    weightMax,
    italic,
    copyright: copyright || fallback,
  }
}

export function fontCovers(
  facts: FontFacts,
  request: { weight: number; italic: boolean }
) {
  return (
    request.weight >= facts.weightMin &&
    request.weight <= facts.weightMax &&
    request.italic === facts.italic
  )
}
