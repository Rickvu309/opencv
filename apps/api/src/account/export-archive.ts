import { crc32, deflateRawSync } from "node:zlib"

export type ArchiveMember = { path: string; bytes: Buffer; compress: boolean }

const STORED = 0
const DEFLATED = 8
const UTF8_NAMES = 0x800

function dosStamp(at: Date) {
  return {
    time:
      (at.getUTCHours() << 11) |
      (at.getUTCMinutes() << 5) |
      Math.floor(at.getUTCSeconds() / 2),
    date:
      ((at.getUTCFullYear() - 1980) << 9) |
      ((at.getUTCMonth() + 1) << 5) |
      at.getUTCDate(),
  }
}

export function zipArchive(
  members: readonly ArchiveMember[],
  madeAt = new Date()
) {
  const stamp = dosStamp(madeAt)
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const member of members) {
    const name = Buffer.from(member.path, "utf8")
    const body = member.compress ? deflateRawSync(member.bytes) : member.bytes
    const method = member.compress ? DEFLATED : STORED
    const checksum = crc32(member.bytes)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_NAMES, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(member.bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)
    const record = Buffer.alloc(46 + name.length)
    record.writeUInt32LE(0x02014b50, 0)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(UTF8_NAMES, 8)
    record.writeUInt16LE(method, 10)
    record.writeUInt16LE(stamp.time, 12)
    record.writeUInt16LE(stamp.date, 14)
    record.writeUInt32LE(checksum, 16)
    record.writeUInt32LE(body.length, 20)
    record.writeUInt32LE(member.bytes.length, 24)
    record.writeUInt16LE(name.length, 28)
    record.writeUInt32LE(offset, 42)
    name.copy(record, 46)
    chunks.push(local, body)
    central.push(record)
    offset += local.length + body.length
  }
  const directorySize = central.reduce((sum, record) => sum + record.length, 0)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(central.length, 8)
  footer.writeUInt16LE(central.length, 10)
  footer.writeUInt32LE(directorySize, 12)
  footer.writeUInt32LE(offset, 16)
  return {
    chunks: [...chunks, ...central, footer],
    byteLength: offset + directorySize + footer.length,
  }
}
