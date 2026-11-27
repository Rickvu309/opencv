import type { QueryClient } from "@tanstack/react-query"

import { catalogClient } from "@/lib/contract-client.ts"

async function enginePaperFile(
  client: QueryClient,
  docId: string,
  format: "docx" | "pdf"
) {
  const file = await catalogClient.run(client, "paper.export", {
    docId,
    format,
  })
  if (!("base64" in file)) throw new Error("Expected a Paper download")
  const bytes = Uint8Array.from(atob(file.base64), (character) =>
    character.charCodeAt(0)
  )
  return {
    name: `${file.name}.${format}`,
    blob: new Blob([bytes], { type: file.contentType }),
  }
}

export async function downloadEnginePaper(
  client: QueryClient,
  docId: string,
  format: "docx" | "pdf"
) {
  const { name, blob } = await enginePaperFile(client, docId, format)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function openEnginePaperPdf(client: QueryClient, docId: string) {
  const viewer = window.open()
  if (!viewer) throw new Error("Could not open the PDF viewer")
  viewer.opener = null
  try {
    const { blob } = await enginePaperFile(client, docId, "pdf")
    if (viewer.closed) return
    const url = URL.createObjectURL(blob)
    viewer.location.replace(url)
  } catch (error) {
    viewer.close()
    throw error
  }
}
