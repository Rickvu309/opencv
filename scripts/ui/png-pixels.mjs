import { inflateSync } from "node:zlib"

const CHANNELS = Object.freeze({ 0: 1, 2: 3, 4: 2, 6: 4 })

function paeth(left, up, corner) {
  const guess = left + up - corner
  const toLeft = Math.abs(guess - left)
  const toUp = Math.abs(guess - up)
  const toCorner = Math.abs(guess - corner)
  if (toLeft <= toUp && toLeft <= toCorner) return left
  return toUp <= toCorner ? up : corner
}

function chunks(bytes) {
  const found = []
  let at = 8
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString("ascii", at + 4, at + 8)
    found.push({ type, data: bytes.subarray(at + 8, at + 8 + length) })
    at += 12 + length
  }
  return found
}

export function decodePng(bytes) {
  const list = chunks(bytes)
  const header = list.find((chunk) => chunk.type === "IHDR").data
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const [depth, colorType, , , interlace] = header.subarray(8, 13)
  const channels = CHANNELS[colorType]
  if (depth !== 8 || !channels || interlace !== 0)
    throw new Error(
      `only 8-bit, non-interlaced gray, RGB or RGBA PNGs are read (depth ${depth}, type ${colorType})`
    )
  const raw = inflateSync(
    Buffer.concat(
      list.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)
    )
  )
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const corner =
        y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      const predict = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][
        filter
      ]
      pixels[y * stride + x] = (line[x] + predict) & 255
    }
  }
  return {
    width,
    height,
    at(x, y) {
      const offset = Math.round(y) * stride + Math.round(x) * channels
      const values = [...pixels.subarray(offset, offset + channels)]
      return channels < 3
        ? [values[0], values[0], values[0]]
        : values.slice(0, 3)
    },
  }
}
