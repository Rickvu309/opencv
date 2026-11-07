const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

const rotateRight = (value: number, bits: number) =>
  (value >>> bits) | (value << (32 - bits))

declare const TextEncoder: {
  new (): { encode(input: string): Uint8Array }
}

export type Fault =
  "none" | "receipt" | "retry" | "parent" | "crash" | "fence" | "exclusive"

export type Lease = {
  readonly writer: string
  readonly epoch: number
  readonly until: number
}

export type Receipt = {
  readonly id: string
  readonly hash: string
}

export type SaveState = {
  fault: Fault
  commits: number
  grants: Lease[]
  head: string
  packages: Map<string, string>
  receipts: Map<string, Receipt>
  retained: Map<string, string>
  lease: Lease | null
  epoch: number
}

export type SaveRequest = {
  id: string
  bytes: string
  parent: string
  lease: Lease
  now: number
  crash?: boolean
}

export function hash(bytes: string): string {
  const data = new TextEncoder().encode(bytes)
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  const bits = data.length * 8
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32))
  view.setUint32(padded.length - 4, bits)
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const words = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1)
      words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const earlier = words[index - 15]
      const recent = words[index - 2]
      words[index] =
        ((rotateRight(earlier, 7) ^
          rotateRight(earlier, 18) ^
          (earlier >>> 3)) +
          words[index - 16] +
          words[index - 7] +
          (rotateRight(recent, 17) ^
            rotateRight(recent, 19) ^
            (recent >>> 10))) >>>
        0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let index = 0; index < 64; index += 1) {
      const upper =
        (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) +
        ((e & f) ^ (~e & g))
      const lower =
        (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) +
        ((a & b) ^ (a & c) ^ (b & c))
      const first = (h + upper + SHA256_K[index] + words[index]) >>> 0
      h = g
      g = f
      f = e
      e = (d + first) >>> 0
      d = c
      c = b
      b = a
      a = (first + (lower >>> 0)) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")
}

export function create(bytes: string, fault: Fault = "none"): SaveState {
  const head = hash(bytes)
  return {
    fault,
    commits: 0,
    grants: [],
    head,
    packages: new Map([[head, bytes]]),
    receipts: new Map(),
    retained: new Map(),
    lease: null,
    epoch: 0,
  }
}

export function grant(
  state: SaveState,
  writer: string,
  now: number,
  ttl = 10
): Lease {
  if (state.fault !== "exclusive" && state.lease && now < state.lease.until)
    throw new Error("lease held")
  const lease = { writer, epoch: ++state.epoch, until: now + ttl }
  state.lease = lease
  state.grants.push({ ...lease })
  return { ...lease }
}

export function save(state: SaveState, request: SaveRequest): Receipt {
  const next = hash(request.bytes)
  const existing = state.receipts.get(request.id)
  if (existing) {
    if (existing.hash !== next) throw new Error("identity mismatch")
    if (state.fault === "retry") state.commits += 1
    return existing
  }
  const lease = state.lease
  const staleLease =
    !lease ||
    request.lease.writer !== lease.writer ||
    request.lease.epoch !== lease.epoch ||
    request.now >= lease.until
  if (state.fault !== "fence" && staleLease) {
    state.retained.set(request.id, request.bytes)
    throw new Error("stale lease")
  }
  if (state.fault !== "parent" && request.parent !== state.head) {
    state.retained.set(request.id, request.bytes)
    throw new Error("stale parent")
  }
  if (request.crash) {
    if (state.fault === "crash") state.head = next
    throw new Error("crash before commit")
  }
  const receipt = { id: request.id, hash: next }
  state.commits += 1
  state.packages.set(next, request.bytes)
  state.head = next
  state.receipts.set(request.id, receipt)
  return receipt
}

export function canShowSaved(
  state: SaveState,
  head: string,
  receipt: Receipt | null
): boolean {
  return (
    state.fault === "receipt" ||
    (state.head === head &&
      state.packages.has(head) &&
      receipt?.hash === head &&
      state.receipts.get(receipt.id)?.id === receipt.id &&
      state.receipts.get(receipt.id)?.hash === receipt.hash)
  )
}
