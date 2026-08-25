import { randomBytes } from "node:crypto"

let lastMs = -1
let seq = 0

/** RFC 9562 UUIDv7 — time-ordered, app-generated (ADR-0006). */
export function createId(now = Date.now()): string {
  const bytes = new Uint8Array(16)
  const ms = BigInt(now)

  bytes[0] = Number((ms >> 40n) & 0xffn)
  bytes[1] = Number((ms >> 32n) & 0xffn)
  bytes[2] = Number((ms >> 24n) & 0xffn)
  bytes[3] = Number((ms >> 16n) & 0xffn)
  bytes[4] = Number((ms >> 8n) & 0xffn)
  bytes[5] = Number(ms & 0xffn)

  if (now === lastMs) {
    seq += 1
  } else {
    lastMs = now
    seq = 0
  }

  bytes.set(randomBytes(10), 6)
  // 12-bit monotonic seq in rand_a so same-ms ids stay ordered.
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f)
  bytes[7] = seq & 0xff
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
