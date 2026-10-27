import { inflateSync } from "node:zlib"

// Stdlib PNG decode for the Coach art compare. No new dependency.
// 8-bit RGB or RGBA, no interlace. That is what canvas.toDataURL and the
// reference crop both write.

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

export function decodePng(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("not a png")
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii")
    const data = buf.subarray(offset + 8, offset + 8 + len)
    offset += 12 + len
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
  }
  if (
    bitDepth !== 8 ||
    interlace !== 0 ||
    (colorType !== 6 && colorType !== 2)
  ) {
    throw new Error(
      `unsupported png ${width}x${height} depth ${bitDepth} type ${colorType} interlace ${interlace}`
    )
  }
  const channels = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const rgba = new Uint8Array(width * height * 4)
  let src = 0
  const prior = new Uint8Array(stride)
  const row = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[src++]
    for (let i = 0; i < stride; i++) {
      const x = raw[src++]
      const left = i >= channels ? row[i - channels] : 0
      const up = prior[i]
      const ul = i >= channels ? prior[i - channels] : 0
      let value = x
      if (filter === 1) value = (x + left) & 255
      else if (filter === 2) value = (x + up) & 255
      else if (filter === 3) value = (x + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) value = (x + paeth(left, up, ul)) & 255
      else if (filter !== 0) throw new Error(`bad png filter ${filter}`)
      row[i] = value
    }
    prior.set(row)
    const dest = y * width * 4
    if (channels === 4) rgba.set(row, dest)
    else {
      for (let x = 0; x < width; x++) {
        rgba[dest + x * 4] = row[x * 3]
        rgba[dest + x * 4 + 1] = row[x * 3 + 1]
        rgba[dest + x * 4 + 2] = row[x * 3 + 2]
        rgba[dest + x * 4 + 3] = 255
      }
    }
  }
  if (src !== raw.length) throw new Error("png inflate length mismatch")
  return { width, height, rgba }
}

export function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) throw new Error("raster is not a data url")
  return decodePng(Buffer.from(dataUrl.slice(comma + 1), "base64"))
}

// Fraction of pixels whose largest RGB channel delta is above `channel`.
// Alpha is ignored: the page fills the card background, the pen crop is opaque.
export function pngMismatch(live, reference, channel) {
  if (live.width !== reference.width || live.height !== reference.height) {
    return {
      ratio: 1,
      bad: live.width * live.height,
      compared: 0,
      reason: `size ${live.width}x${live.height} vs ${reference.width}x${reference.height}`,
    }
  }
  const n = live.width * live.height
  let bad = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const delta = Math.max(
      Math.abs(live.rgba[o] - reference.rgba[o]),
      Math.abs(live.rgba[o + 1] - reference.rgba[o + 1]),
      Math.abs(live.rgba[o + 2] - reference.rgba[o + 2])
    )
    if (delta > channel) bad += 1
  }
  return { ratio: bad / n, bad, compared: n, reason: "" }
}
