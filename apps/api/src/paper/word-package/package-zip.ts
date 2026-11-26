import { createInflateRaw } from "node:zlib"

import { refuse } from "./package-errors.js"
import { PACKAGE_LIMITS } from "./package-limits.js"

const decoder = new TextDecoder("utf-8", { fatal: true })
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

export function crc32(bytes: Uint8Array) {
  let value = 0xffffffff
  for (const byte of bytes)
    value = crcTable[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

type ZipEntry = {
  name: string
  central: Buffer
  local: Buffer
  compressed: Buffer
  headerSize: number
  descriptor: Buffer
  method: number
  size: number
  checksum: number
  offset: number
}

function within(bytes: Buffer, start: number, length: number) {
  if (start < 0 || length < 0 || start + length > bytes.length) {
    refuse("INVALID_ZIP_BOUNDS")
  }
}

function memberName(bytes: Buffer, utf8: boolean) {
  if (!utf8 && bytes.some((value) => value > 127)) refuse("ZIP_ENCODING")
  const name = decoder.decode(bytes)
  if (
    !name ||
    name.includes("\\") ||
    name.includes("\0") ||
    name.includes("%") ||
    name.includes(":") ||
    name.startsWith("/") ||
    name
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  )
    refuse("UNSAFE_ZIP_NAME", name)
  return name
}

function directory(input: Uint8Array) {
  if (input.byteLength > PACKAGE_LIMITS.compressedBytes)
    refuse("ZIP_INPUT_LIMIT")
  const bytes = Buffer.from(input)
  let end = -1
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (
      bytes.readUInt32LE(at) === 0x06054b50 &&
      at + 22 + bytes.readUInt16LE(at + 20) === bytes.length
    ) {
      end = at
      break
    }
  }
  if (end < 0) refuse("INVALID_ZIP_END")
  const count = bytes.readUInt16LE(end + 10)
  const start = bytes.readUInt32LE(end + 16)
  const size = bytes.readUInt32LE(end + 12)
  if (
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    count !== bytes.readUInt16LE(end + 8) ||
    count === 65535 ||
    start === 0xffffffff ||
    size === 0xffffffff ||
    start + size !== end
  )
    refuse("UNSUPPORTED_ZIP_LAYOUT")
  if (!count || count > PACKAGE_LIMITS.members) refuse("ZIP_MEMBER_COUNT")
  const entries: ZipEntry[] = []
  const names = new Set<string>()
  let at = start
  let total = 0
  for (let index = 0; index < count; index++) {
    within(bytes, at, 46)
    if (bytes.readUInt32LE(at) !== 0x02014b50) refuse("INVALID_ZIP_DIRECTORY")
    const length =
      46 +
      bytes.readUInt16LE(at + 28) +
      bytes.readUInt16LE(at + 30) +
      bytes.readUInt16LE(at + 32)
    within(bytes, at, length)
    if (at + length > end) refuse("INVALID_ZIP_DIRECTORY")
    const flags = bytes.readUInt16LE(at + 8)
    const method = bytes.readUInt16LE(at + 10)
    if (
      flags & ~0x080e ||
      ![0, 8].includes(method) ||
      bytes.readUInt16LE(at + 34)
    ) {
      refuse("UNSUPPORTED_ZIP_MEMBER")
    }
    const name = memberName(
      bytes.subarray(at + 46, at + 46 + bytes.readUInt16LE(at + 28)),
      Boolean(flags & 0x800)
    )
    if (names.has(name.toLowerCase())) refuse("DUPLICATE_ZIP_MEMBER", name)
    names.add(name.toLowerCase())
    const compressedSize = bytes.readUInt32LE(at + 20)
    const memberSize = bytes.readUInt32LE(at + 24)
    total += memberSize
    if (
      memberSize > PACKAGE_LIMITS.memberBytes ||
      total > PACKAGE_LIMITS.inflatedBytes ||
      memberSize > Math.max(1, compressedSize) * PACKAGE_LIMITS.compressionRatio
    )
      refuse("ZIP_EXPANSION_LIMIT", name)
    const offset = bytes.readUInt32LE(at + 42)
    within(bytes, offset, 30)
    if (bytes.readUInt32LE(offset) !== 0x04034b50) refuse("INVALID_ZIP_LOCAL")
    const dataAt =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28)
    within(bytes, offset, dataAt - offset + compressedSize)
    const localName = bytes.subarray(
      offset + 30,
      offset + 30 + bytes.readUInt16LE(offset + 26)
    )
    if (
      !localName.equals(
        bytes.subarray(at + 46, at + 46 + bytes.readUInt16LE(at + 28))
      ) ||
      bytes.readUInt16LE(offset + 6) !== flags ||
      bytes.readUInt16LE(offset + 8) !== method ||
      [14, 18, 22].some((field, index) => {
        const value = bytes.readUInt32LE(offset + field)
        return (
          value !==
            [bytes.readUInt32LE(at + 16), compressedSize, memberSize][index] &&
          (!(flags & 8) || value !== 0)
        )
      }) ||
      dataAt + compressedSize > start
    )
      refuse("ZIP_LOCAL_DIRECTORY_MISMATCH", name)
    const dataEnd = dataAt + compressedSize
    let descriptorSize = 0
    if (flags & 8) {
      const matches = (prefix: number) =>
        dataEnd + prefix + 12 <= start &&
        bytes.readUInt32LE(dataEnd + prefix) === bytes.readUInt32LE(at + 16) &&
        bytes.readUInt32LE(dataEnd + prefix + 4) === compressedSize &&
        bytes.readUInt32LE(dataEnd + prefix + 8) === memberSize
      if (
        dataEnd + 16 <= start &&
        bytes.readUInt32LE(dataEnd) === 0x08074b50 &&
        matches(4)
      )
        descriptorSize = 16
      else if (matches(0)) descriptorSize = 12
      else refuse("ZIP_DESCRIPTOR_MISMATCH", name)
    }
    entries.push({
      name,
      method,
      size: memberSize,
      offset,
      checksum: bytes.readUInt32LE(at + 16),
      central: bytes.subarray(at, at + length),
      local: bytes.subarray(offset, dataEnd + descriptorSize),
      headerSize: dataAt - offset,
      descriptor: bytes.subarray(dataEnd, dataEnd + descriptorSize),
      compressed: bytes.subarray(dataAt, dataAt + compressedSize),
    })
    at += length
  }
  if (at !== end) refuse("INVALID_ZIP_DIRECTORY_SUFFIX")
  const ordered = [...entries].sort((left, right) => left.offset - right.offset)
  let expected = 0
  for (const entry of ordered) {
    if (entry.offset !== expected) refuse("ZIP_GAP_OR_OVERLAP")
    expected += entry.local.length
  }
  if (expected !== start) refuse("ZIP_GAP_OR_OVERLAP")
  return { bytes, entries, ordered, footer: bytes.subarray(end) }
}

async function inflate(entry: ZipEntry, remaining: number) {
  const limit = Math.min(entry.size, PACKAGE_LIMITS.memberBytes, remaining)
  if (entry.method === 0) {
    if (entry.compressed.length !== entry.size) refuse("ZIP_SIZE_MISMATCH")
    return Buffer.from(entry.compressed)
  }
  const inflater = createInflateRaw({ chunkSize: 16 * 1024 })
  const chunks: Buffer[] = []
  let size = 0
  try {
    const result = new Promise<Buffer>((resolve, reject) => {
      inflater.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) {
          inflater.destroy(new Error("ZIP_STREAM_LIMIT"))
          return
        }
        chunks.push(chunk)
      })
      inflater.once("error", reject)
      inflater.once("end", () => resolve(Buffer.concat(chunks, size)))
    })
    inflater.end(entry.compressed)
    const bytes = await result
    if (
      inflater.bytesWritten !== entry.compressed.length ||
      bytes.length !== entry.size
    ) {
      refuse("ZIP_SIZE_MISMATCH", entry.name)
    }
    return bytes
  } finally {
    inflater.destroy()
  }
}

export async function readPackageZip(input: Uint8Array) {
  const archive = directory(input)
  const files = new Map<string, Buffer>()
  let total = 0
  for (const entry of archive.entries) {
    const bytes = await inflate(entry, PACKAGE_LIMITS.inflatedBytes - total)
    total += bytes.length
    if (crc32(bytes) !== entry.checksum) refuse("ZIP_CRC_MISMATCH", entry.name)
    files.set(entry.name, bytes)
  }
  return { ...archive, files }
}
