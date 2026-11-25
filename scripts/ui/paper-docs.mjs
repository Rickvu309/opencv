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
    const minted = await command(page, apiOrigin, origin, "paper.canvas", {
      op: "mint",
      label: doc.label,
    })
    if (!minted.docId) throw new Error("paper.canvas returned no docId")
    await command(page, apiOrigin, origin, "paper.update", {
      docId: minted.docId,
      patch: { name: doc.name },
    })
  }
}
