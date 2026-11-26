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

export async function seedPaperDocs(page, apiOrigin, origin, spec) {
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
