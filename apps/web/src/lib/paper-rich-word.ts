import { nativeBasisSchema, sameNativeProvenance } from "@workspace/domain"
import { apiRequest } from "./api.ts"
import { endpoints } from "./requests.ts"
import type { openRichNativePaperSync } from "./paper-native-transport.ts"

type Saved = NonNullable<
  ReturnType<ReturnType<typeof openRichNativePaperSync>["captureSaved"]>
>

function filename(disposition: string | null) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1]
  const value = encoded ? decodeURIComponent(encoded) : quoted
  const unsafe = value?.split("").some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 || character === "/" || character === "\\"
  })
  return value && !unsafe && value.endsWith(".docx") ? value : "Paper.docx"
}

export async function downloadSavedRichWord(saved: Saved, signal: AbortSignal) {
  const check = () => {
    signal.throwIfAborted()
    if (!saved.current())
      throw new Error("Your document changed. Download again when it is saved.")
  }
  check()
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(saved.canonical)
  )
  check()
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
  const basis = nativeBasisSchema.parse({ ...saved.basis, digest })
  const response = await apiRequest(
    endpoints.paperNativeWord(saved.identity.docId, saved.kind),
    {
      signal,
      cache: "no-store",
      headers: {
        "x-paper-writer": JSON.stringify(saved.identity.writer),
        "x-paper-basis": JSON.stringify(basis),
      },
    }
  )
  check()
  const returned = nativeBasisSchema.parse(
    JSON.parse(response.headers.get("x-paper-basis") ?? "null")
  )
  if (
    returned.epoch !== basis.epoch ||
    returned.revision !== basis.revision ||
    returned.digest !== basis.digest ||
    !sameNativeProvenance(returned.provenance, basis.provenance) ||
    response.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    throw new Error("Paper could not confirm this Word download. Try again.")
  const name = filename(response.headers.get("content-disposition"))
  const blob = await response.blob()
  check()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  let triggered = false
  try {
    anchor.href = url
    anchor.download = name
    anchor.hidden = true
    document.body.append(anchor)
    check()
    anchor.click()
    triggered = true
  } finally {
    anchor.remove()
    if (triggered) {
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel)
        URL.revokeObjectURL(url)
      }, 1000)
      const cancel = () => {
        clearTimeout(timer)
        signal.removeEventListener("abort", cancel)
        URL.revokeObjectURL(url)
      }
      signal.addEventListener("abort", cancel, { once: true })
      if (signal.aborted) cancel()
    } else URL.revokeObjectURL(url)
  }
}
