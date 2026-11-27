import { crc32, deflateRawSync } from "node:zlib"

export function zipDocx(parts: ReadonlyMap<string, string | Uint8Array>) {
  const members: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  let directorySize = 0

  for (const [path, content] of parts) {
    const name = Buffer.from(path)
    const bytes = Buffer.from(content)
    const compress = typeof content === "string"
    const body = compress ? deflateRawSync(bytes) : bytes
    const method = compress ? 8 : 0
    const checksum = crc32(bytes)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(20, 4)
    local.copy(central, 6, 4, 30)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)

    members.push(local, body)
    directory.push(central)
    offset += local.length + body.length
    directorySize += central.length
  }

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(directory.length, 8)
  end.writeUInt16LE(directory.length, 10)
  end.writeUInt32LE(directorySize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...members, ...directory, end])
}
