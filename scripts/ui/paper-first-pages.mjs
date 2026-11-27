const PAPER_LIST = "/api/reads/paper.list"
const FIRST_PAGES = "/api/reads/paper.firstPages"

function rows(spec) {
  const now = new Date().toISOString()
  return spec.docs.map((doc, index) => ({
    id: `15500000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: doc.name,
    kind: doc.kind ?? "cv",
    templateId: null,
    status: "draft",
    contentVersion: 0,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    ...(doc.lines ? { preview: doc.lines } : {}),
    ...(doc.lines ? {} : { engine: 2 }),
    createdAt: now,
    updatedAt: now,
  }))
}

export async function mockFirstPageLibrary(page, spec, repo) {
  const pages = await page.evaluate(
    async ({ docs, repo }) => {
      const { labDocument } = await import(
        `/@fs/${repo}/apps/web/src/features/paper/editor/lab-documents.ts`
      )
      const engine = await import(
        `/@fs/${repo}/packages/paper-engine/src/index.ts`
      )
      const layouter = engine.createLayouter(engine.paperFontMetrics)
      return docs.map((doc) =>
        doc.lines ? null : layouter.layout(labDocument(doc.doc), null).pages[0]
      )
    },
    { docs: spec.docs, repo }
  )
  const documents = rows(spec)
  const pagesById = new Map(
    documents.flatMap(({ id }, index) =>
      pages[index] ? [[id, { id, page: pages[index] }]] : []
    )
  )
  await page.route(
    (url) => url.pathname === PAPER_LIST || url.pathname === FIRST_PAGES,
    (route) => {
      const request = route.request()
      const origin = request.headers().origin
      const cors = origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Expose-Headers": "content-type",
          }
        : {}
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            ...cors,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              request.headers()["access-control-request-headers"] ??
              "content-type",
          },
        })
      const data =
        new URL(request.url()).pathname === PAPER_LIST
          ? documents
          : request.postDataJSON().ids.flatMap((id) => {
              const page = pagesById.get(id)
              return page ? [page] : []
            })
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({ ok: true, data }),
      })
    }
  )
}
