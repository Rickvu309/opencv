import { readPublicBytes } from "@/lib/public-bytes.ts"
import { fontCovers, fontFacts } from "./font-file.ts"
import { attr, byLocal, xmlDoc } from "./source-line.ts"

export type FontFace = {
  family: string
  bold: boolean
  italic: boolean
}

type Job = {
  family: string
  weight: number
  italic: boolean
  url: string
  claim: string
}

const reads = new Map<string, Promise<Uint8Array | null>>()

export function clearLoadedFaces() {
  reads.clear()
}

function styleLabel(family: string, weight: number, italic: boolean) {
  const marks = [weight >= 700 ? "bold" : "", italic ? "italic" : ""].filter(
    Boolean
  )
  return marks.length ? `${family} ${marks.join(" ")}` : family
}

function staticJobs(family: string, stem: string, using: string): Job[] {
  const files = [
    ["Regular", 400, false],
    ["Bold", 700, false],
    ["Italic", 400, true],
    ["BoldItalic", 700, true],
  ] as const
  return files.map(([name, weight, italic]) => ({
    family,
    weight,
    italic,
    url: `/fonts/${stem}-${name}.ttf`,
    claim: `${styleLabel(family, weight, italic)} is shown using ${using}.`,
  }))
}

function originalJobs(family: string, url: string, italicUrl?: string): Job[] {
  const jobs: Job[] = []
  for (const weight of [400, 700]) {
    jobs.push({
      family,
      weight,
      italic: false,
      url,
      claim: `${styleLabel(family, weight, false)} is the original font.`,
    })
    if (!italicUrl) continue
    jobs.push({
      family,
      weight,
      italic: true,
      url: italicUrl,
      claim: `${styleLabel(family, weight, true)} is the original font.`,
    })
  }
  return jobs
}

function substituteJobs(family: string, url: string, using: string): Job[] {
  return [400, 700].map((weight) => ({
    family,
    weight,
    italic: false,
    url,
    claim: `${styleLabel(family, weight, false)} is shown using ${using}.`,
  }))
}

const jobs: Job[] = [
  ...substituteJobs(
    "Century Gothic",
    "/fonts/Jost.ttf",
    "Jost (different metrics)"
  ),
  {
    family: "Calibri",
    weight: 400,
    italic: false,
    url: "/fonts/Carlito.ttf",
    claim: "Calibri is shown using Carlito (metric-compatible).",
  },
  {
    family: "Cambria",
    weight: 400,
    italic: false,
    url: "/fonts/Caladea.ttf",
    claim: "Cambria is shown using Caladea (metric-compatible).",
  },
  ...staticJobs(
    "Arial",
    "LiberationSans",
    "Liberation Sans (metric-compatible)"
  ),
  ...staticJobs(
    "Times New Roman",
    "LiberationSerif",
    "Liberation Serif (metric-compatible)"
  ),
  ...staticJobs(
    "Courier New",
    "LiberationMono",
    "Liberation Mono (metric-compatible)"
  ),
  ...staticJobs(
    "Georgia",
    "LiberationSerif",
    "Liberation Serif (no certified equivalent)"
  ),
  ...staticJobs(
    "Constantia",
    "LiberationSerif",
    "Liberation Serif (no certified equivalent)"
  ),
  ...staticJobs(
    "Garamond",
    "LiberationSerif",
    "Liberation Serif (no certified equivalent)"
  ),
  ...staticJobs(
    "Aptos",
    "LiberationSans",
    "Liberation Sans (no certified equivalent)"
  ),
  ...staticJobs(
    "Aptos Display",
    "LiberationSans",
    "Liberation Sans (no certified equivalent)"
  ),
  {
    family: "Montserrat Light",
    weight: 300,
    italic: false,
    url: "/fonts/Montserrat.ttf",
    claim:
      "Montserrat Light is shown using Montserrat (Light instance not certified).",
  },
  ...staticJobs(
    "Cambria Math",
    "LiberationSerif",
    "Liberation Serif (no math font shipped)"
  ),
  ...originalJobs(
    "Open Sans",
    "/fonts/OpenSans.ttf",
    "/fonts/OpenSans-Italic.ttf"
  ),
  ...originalJobs("Montserrat", "/fonts/Montserrat.ttf"),
]

function requestedWeight(face: FontFace) {
  if (face.bold) return 700
  if (face.family === "Montserrat Light") return 300
  return 400
}

function jobFor(face: FontFace) {
  const weight = requestedWeight(face)
  return jobs.find(
    (job) =>
      job.family === face.family &&
      job.weight === weight &&
      job.italic === face.italic
  )
}

function label(face: FontFace) {
  return styleLabel(face.family, requestedWeight(face), face.italic)
}

export function fontSentence(face: FontFace, painted: boolean) {
  if (!painted) return `${label(face)} is shown using no shipped file.`
  return jobFor(face)?.claim ?? `${label(face)} is shown using no shipped file.`
}

async function fontBytes(url: string) {
  const cached = reads.get(url)
  if (cached) return cached
  const pending = readPublicBytes(url)
  reads.set(url, pending)
  return pending
}

export async function faceLoaded(face: FontFace) {
  const job = jobFor(face)
  if (!job || typeof FontFace !== "function") return false
  if (!document.fonts || typeof document.fonts.add !== "function") return false
  try {
    const bytes = await fontBytes(job.url)
    if (!bytes) return false
    const facts = fontFacts(bytes)
    if (!fontCovers(facts, { weight: job.weight, italic: job.italic })) {
      return false
    }
    const weight =
      facts.weightMin === facts.weightMax
        ? String(facts.weightMin)
        : `${facts.weightMin} ${facts.weightMax}`
    const owned = new ArrayBuffer(bytes.byteLength)
    const faceBytes = new Uint8Array(owned)
    faceBytes.set(bytes)
    const painted = new FontFace(job.family, faceBytes, {
      style: job.italic ? "italic" : "normal",
      weight,
    })
    const ready = await painted.load()
    if (ready.status !== "loaded") return false
    document.fonts.add(ready)
    return true
  } catch {
    return false
  }
}

export async function fontWarning(faces: FontFace[]) {
  const sentences: string[] = []
  for (const face of faces) {
    const sentence = fontSentence(face, await faceLoaded(face))
    if (!sentences.includes(sentence)) sentences.push(sentence)
  }
  return sentences.join(" ")
}

function turnedOn(props: Element | null, name: string) {
  if (!props) return false
  const mark = [...props.children].find((node) => node.localName === name)
  if (!mark) return false
  const value = attr(mark, "val").toLowerCase()
  return (
    value !== "0" && value !== "false" && value !== "off" && value !== "none"
  )
}

function addFace(
  faces: FontFace[],
  family: string,
  bold: boolean,
  italic: boolean
) {
  const trimmed = family.trim()
  if (!trimmed) return
  if (
    faces.some(
      (face) =>
        face.family === trimmed && face.bold === bold && face.italic === italic
    )
  ) {
    return
  }
  faces.push({ family: trimmed, bold, italic })
}

export function fontFacesFromXml(parts: string[]) {
  const faces: FontFace[] = []
  for (const source of parts) {
    if (!source.includes("rFonts") && !source.includes("latin")) continue
    const doc = xmlDoc(source)
    for (const fonts of byLocal(doc, "rFonts")) {
      const props = fonts.parentElement
      const bold = turnedOn(props, "b") || turnedOn(props, "bCs")
      const italic = turnedOn(props, "i") || turnedOn(props, "iCs")
      addFace(faces, attr(fonts, "ascii"), bold, italic)
      addFace(faces, attr(fonts, "hAnsi"), bold, italic)
    }
    for (const latin of byLocal(doc, "latin")) {
      addFace(faces, latin.getAttribute("typeface") ?? "", false, false)
    }
  }
  return faces
}
