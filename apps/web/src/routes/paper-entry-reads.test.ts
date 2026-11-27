import { afterEach, expect, it, vi } from "vitest"
import { createMemoryHistory } from "@tanstack/react-router"

import { layoutPageSchema } from "@workspace/domain/paper-doc"
import { createLayouter, paperFontMetrics } from "@workspace/paper-engine"

import { labDocument } from "@/features/paper/editor/lab-documents.ts"
import { faceStyle, pageFaceKeys } from "@/features/paper/editor/paper-faces.ts"
import { createQueryClient } from "@/lib/query-client.ts"
import { pathOf } from "@/test/mock-http.ts"
import { createAppRouter } from "@/router.tsx"

const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")

afterEach(() => {
  vi.unstubAllGlobals()
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
})

function storedFirstPage() {
  const layout = createLayouter(paperFontMetrics).layout(
    labDocument("en-10"),
    null
  )
  return layoutPageSchema.parse(layout.pages[0]!)
}

it("entering the library starts the list read and the card fonts before the page code renders", async () => {
  const firstPage = storedFirstPage()
  const requested: string[] = []
  const loading: string[] = []
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    requested.push(pathOf(input))
    if (pathOf(input) === "/api/reads/paper.list")
      return Response.json({
        ok: true,
        data: [
          {
            id: "15500000-0000-4000-8000-000000000001",
            name: "CV 1",
            kind: "cv",
            templateId: null,
            status: "draft",
            contentVersion: 0,
            checks: [],
            pageChoice: "unset",
            isFavorite: false,
            sourceFileId: null,
            firstPage,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    return Response.json({ ok: true, data: [] })
  })
  vi.stubGlobal(
    "FontFace",
    class {
      family: string
      source: string
      descriptors: { weight: string; style: string }
      constructor(
        family: string,
        source: string,
        descriptors: { weight: string; style: string }
      ) {
        this.family = family
        this.source = source
        this.descriptors = descriptors
      }
      load() {
        loading.push(
          `${this.family} ${this.descriptors.weight} ${this.descriptors.style}`
        )
        return Promise.resolve(this)
      }
    }
  )
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add: () => undefined },
  })
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ["/paper"] }),
    queryClient: createQueryClient(),
  })

  await router.load()
  await vi.waitFor(() => expect(loading.length).toBeGreaterThan(0))

  expect(requested).toContain("/api/reads/paper.list")
  const used = [...pageFaceKeys([firstPage])].map((key) => {
    const { family, weight, style } = faceStyle(key)
    return `${family} ${weight} ${style}`
  })
  expect(used.length).toBeGreaterThan(0)
  expect(new Set(loading)).toEqual(new Set(used))
})
