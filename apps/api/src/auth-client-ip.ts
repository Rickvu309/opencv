import { createHash } from "node:crypto"

export const CLIENT_KEY_HEADER = "x-opencv-client-key"

const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
]

const RAILWAY_AND_PRIVATE_RANGES = [
  "100.64.0.0/10",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
]

export const CLIENT_IP_CONFIG = {
  ipAddressHeaders: ["x-forwarded-for", CLIENT_KEY_HEADER],
  trustedProxies: [...CLOUDFLARE_RANGES, ...RAILWAY_AND_PRIVATE_RANGES],
}

const MAX_IDENTIFIED_BODY_BYTES = 4096

async function emailInBody(request: Request) {
  if (request.method !== "POST") return null
  if (!request.headers.get("content-type")?.includes("json")) return null
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > MAX_IDENTIFIED_BODY_BYTES) return null
  try {
    const body: unknown = await request.clone().json()
    const email = (body as { email?: unknown } | null)?.email
    return typeof email === "string" && email.trim()
      ? email.trim().toLowerCase()
      : null
  } catch {
    return null
  }
}

async function callerIdentity(request: Request) {
  const email = await emailInBody(request)
  if (email) return `email:${email}`
  const cookie = request.headers.get("cookie")
  if (cookie) return `cookie:${cookie}`
  const agent = request.headers.get("user-agent") ?? ""
  const language = request.headers.get("accept-language") ?? ""
  return `agent:${agent}|${language}`
}

function addressFromIdentity(identity: string) {
  const digest = createHash("sha256").update(identity).digest()
  const groups = [0xfd00 | (digest[0] ?? 0)]
  for (let i = 1; i < 8; i += 1) {
    groups.push(digest.readUInt16BE(i * 2 - 1))
  }
  return groups.map((group) => group.toString(16)).join(":")
}

export async function withClientKey(request: Request) {
  const headers = new Headers(request.headers)
  headers.set(
    CLIENT_KEY_HEADER,
    addressFromIdentity(await callerIdentity(request))
  )
  return new Request(request, { headers })
}
