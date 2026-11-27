import { readFile } from "node:fs/promises"

const CV_CORPUS = new URL(
  "../../packages/paper-corpus/tests/fixtures/cvs/",
  import.meta.url
)

const LETTER_NAME = /^(letter|thư)(\s|$)/i

export function paperDocPlan({ count, names = [] }) {
  return Array.from({ length: count }, (_, index) => {
    const fromNewest = count - 1 - index
    const name =
      names[fromNewest] ??
      (index % 4 === 3
        ? `Letter to Company ${index + 1}`
        : `CV for Company ${index + 1}`)
    return { name, label: LETTER_NAME.test(name) ? "letter" : "cv" }
  })
}

async function command(page, apiOrigin, origin, name, input) {
  const response = await page.request.post(
    `${apiOrigin}/api/commands/${name}`,
    {
      headers: { origin },
      data: { input, idempotencyKey: crypto.randomUUID() },
    }
  )
  if (!response.ok()) throw new Error(`${name} answered ${response.status()}`)
  const body = await response.json()
  return body.data?.result ?? body.data ?? {}
}

async function importWord(page, apiOrigin, origin, fixture) {
  const name = `${fixture}.docx`
  const response = await page.request.post(
    `${apiOrigin}/api/paper/import?engine=2`,
    {
      headers: { origin },
      multipart: {
        file: {
          name,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: await readFile(new URL(name, CV_CORPUS)),
        },
      },
    }
  )
  const result = await response.json()
  if (!response.ok() || !result.data?.docId)
    throw new Error(`Paper import failed: ${JSON.stringify(result.error)}`)
  await page.goto(`${origin}/paper-lab?paper=${result.data.docId}`, {
    waitUntil: "domcontentloaded",
  })
}

export async function seedPaperDocs(page, apiOrigin, origin, spec) {
  if (spec.importWord)
    return importWord(page, apiOrigin, origin, spec.importWord)
  for (const doc of paperDocPlan(spec)) {
    const created = await command(page, apiOrigin, origin, "paper.create", {
      kind: doc.label,
      format: "rich",
      name: doc.name,
      ...(spec.lines ? { lines: spec.lines } : {}),
    })
    if (!created.id) throw new Error("paper.create returned no id")
  }
}
