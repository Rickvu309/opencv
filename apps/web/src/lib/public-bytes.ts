export async function readPublicBytes(url: string): Promise<Uint8Array | null> {
  if (!url.startsWith("/fonts/") || url.includes("..")) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}
