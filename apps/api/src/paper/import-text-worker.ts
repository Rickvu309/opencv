import { parentPort, workerData } from "node:worker_threads"
import { constants, inflateRawSync, inflateSync } from "node:zlib"

type ReadLimits = {
  pdfPages: number
  pdfStreams: number
  inflatedBytes: number
  itemsPerPage: number
  textChars: number
}

type TextJob = {
  kind: "pdf" | "docx"
  bytes: Uint8Array
  whole: boolean
  limits: ReadLimits
}

type TextOutcome =
  | { ok: true; text: string }
  | { ok: false; reason: "pages" | "locked" | "heavy" | "text" | "failed" }

type PdfItem = { str?: string; hasEOL?: boolean }

type PdfPage = {
  streamTextContent: () => ReadableStream<{ items: PdfItem[] }>
}

type PdfDocument = {
  numPages: number
  getPage: (page: number) => Promise<PdfPage>
}

const STREAM = Buffer.from("stream")
const END_STREAM = Buffer.from("endstream")

function streamDataStart(bytes: Buffer, at: number) {
  let start = at + STREAM.length
  if (bytes[start] === 0x0d) start += 1
  if (bytes[start] === 0x0a) start += 1
  return start
}

function isEndStream(bytes: Buffer, at: number) {
  return at >= 3 && bytes.toString("latin1", at - 3, at) === "end"
}

function inflatedSize(data: Buffer, room: number, raw = false) {
  try {
    return (raw ? inflateRawSync : inflateSync)(data, {
      maxOutputLength: room + 1,
      finishFlush: constants.Z_SYNC_FLUSH,
    }).byteLength
  } catch (error) {
    if (error instanceof RangeError) return room + 1
    return 0
  }
}

export function pdfStreamsFit(bytes: Buffer, limits: ReadLimits) {
  let total = 0
  let streams = 0
  let at = bytes.indexOf(STREAM)
  while (at !== -1) {
    if (isEndStream(bytes, at)) {
      at = bytes.indexOf(STREAM, at + STREAM.length)
      continue
    }
    streams += 1
    if (streams > limits.pdfStreams) return false
    const start = streamDataStart(bytes, at)
    const end = bytes.indexOf(END_STREAM, start)
    const stop = end === -1 ? bytes.length : end
    total += inflatedSize(
      bytes.subarray(start, stop),
      limits.inflatedBytes - total
    )
    if (total > limits.inflatedBytes) return false
    if (end === -1) return true
    at = bytes.indexOf(STREAM, end + END_STREAM.length)
  }
  return true
}

async function pdfText(job: TextJob): Promise<TextOutcome> {
  const bytes = Buffer.from(
    job.bytes.buffer,
    job.bytes.byteOffset,
    job.bytes.byteLength
  )
  if (!pdfStreamsFit(bytes, job.limits)) return { ok: false, reason: "heavy" }
  const unpdf = await import("unpdf")
  let pdf: PdfDocument
  try {
    pdf = (await unpdf.getDocumentProxy(new Uint8Array(job.bytes), {
      verbosity: 0,
    })) as unknown as PdfDocument
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException")
      return { ok: false, reason: "locked" }
    throw error
  }
  if (job.whole && pdf.numPages > job.limits.pdfPages)
    return { ok: false, reason: "pages" }
  const count = Math.min(pdf.numPages, job.limits.pdfPages)
  const pages: string[] = []
  let chars = 0
  for (let number = 1; number <= count; number += 1) {
    const reader = (await pdf.getPage(number)).streamTextContent().getReader()
    let items = 0
    let text = ""
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      for (const item of chunk.value.items) {
        const piece = (item.str ?? "") + (item.hasEOL ? "\n" : "")
        items += 1
        chars += piece.length
        if (items > job.limits.itemsPerPage || chars > job.limits.textChars) {
          await reader.cancel()
          if (job.whole) return { ok: false, reason: "text" }
          pages.push(text)
          return { ok: true, text: pages.join("\n") }
        }
        text += piece
      }
    }
    pages.push(text)
  }
  return { ok: true, text: pages.join("\n") }
}

export function zipMembersFit(bytes: Buffer, limits: ReadLimits) {
  let total = 0
  let offset = 0
  while (
    offset + 30 <= bytes.length &&
    bytes.readUInt32LE(offset) === 0x04034b50
  ) {
    const method = bytes.readUInt16LE(offset + 8)
    const compressed = bytes.readUInt32LE(offset + 18)
    const start =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28)
    const data = bytes.subarray(
      start,
      Math.min(bytes.length, start + compressed)
    )
    const room = limits.inflatedBytes - total
    total += method === 8 ? inflatedSize(data, room, true) : data.length
    if (total > limits.inflatedBytes) return false
    if (start + compressed <= offset) return false
    offset = start + compressed
  }
  return true
}

type MammothApi = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>
}

async function docxText(job: TextJob): Promise<TextOutcome> {
  const bytes = Buffer.from(
    job.bytes.buffer,
    job.bytes.byteOffset,
    job.bytes.byteLength
  )
  if (!zipMembersFit(bytes, job.limits)) return { ok: false, reason: "heavy" }
  const loaded = (await import("mammoth")) as MammothApi & {
    default?: MammothApi
  }
  const mammoth = loaded.default ?? loaded
  const extracted = await mammoth.extractRawText({
    buffer: Buffer.from(
      job.bytes.buffer,
      job.bytes.byteOffset,
      job.bytes.byteLength
    ),
  })
  return { ok: true, text: extracted.value.slice(0, job.limits.textChars) }
}

async function readJob(job: TextJob): Promise<TextOutcome> {
  try {
    return job.kind === "pdf" ? await pdfText(job) : await docxText(job)
  } catch {
    return { ok: false, reason: "failed" }
  }
}

if (parentPort && workerData) {
  const port = parentPort
  void readJob(workerData as TextJob).then((outcome) =>
    port.postMessage(outcome)
  )
}
