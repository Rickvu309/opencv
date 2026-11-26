import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import {
  RICH_DOCUMENT_ID,
  richDocumentAnswer,
} from "./rich-document-answer.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url)).replace(
  /\/$/,
  ""
)
const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url)
)
const Y = require("yjs")
const ID = RICH_DOCUMENT_ID

export async function openRichDocument(page, origin, answer, repo = root) {
  const fixture = await page.evaluate(async (root) => {
    const { storedFlowFixture } = await import(
      `/@fs/${root}/packages/paper-crdt/src/test/flow-fixture.ts`
    )
    const { seedStoredYDoc } = await import(
      `/@fs/${root}/packages/paper-crdt/src/stored-document.ts`
    )
    const { nativeProvenance, richPaperDocumentSchema } = await import(
      `/@fs/${root}/packages/domain/src/paper-doc/public.ts`
    )
    const document = storedFlowFixture("cv")
    document.presentation.page.width = 12240
    document.presentation.page.height = 15840
    document.presentation.inline = { fontId: "liberation-serif", size: 240 }
    document.flow.children[0].page = document.presentation.page
    document.flow.children[0].children = [
      ...document.flow.children[0].children.filter(
        (node) => node.type === "header"
      ),
      {
        id: "summary",
        type: "heading",
        level: 2,
        paragraph: {},
        content: [{ text: "Summary" }],
      },
      {
        id: "intro",
        type: "paragraph",
        paragraph: {},
        content: [
          {
            text: "Product designer in Hanoi. Five years of shipping thoughtful tools for people.",
          },
        ],
      },
      {
        id: "experience",
        type: "heading",
        level: 2,
        paragraph: {},
        content: [{ text: "Experience" }],
      },
      {
        id: "work",
        type: "paragraph",
        paragraph: {},
        content: [
          {
            text: "Led the design of a collaborative workspace from research through release.",
          },
        ],
      },
      {
        id: "education",
        type: "heading",
        level: 2,
        paragraph: {},
        content: [{ text: "Education" }],
      },
      {
        id: "school",
        type: "paragraph",
        paragraph: {},
        content: [{ text: "Design studies, Hanoi." }],
      },
    ]
    const result = richPaperDocumentSchema.safeParse(document)
    if (!result.success) throw new Error(JSON.stringify(result.error.issues))
    const parsed = result.data
    return {
      provenance: nativeProvenance(parsed),
      update: Array.from(seedStoredYDoc(parsed)),
    }
  }, repo)
  const remote = new Y.Doc()
  Y.applyUpdate(remote, Uint8Array.from(fixture.update))
  let revision = 0
  await page.route(
    (url) => url.pathname === `/api/paper/${ID}/document`,
    (route) =>
      route.fulfill(
        answer(route.request(), {
          status: 200,
          json: richDocumentAnswer(fixture.provenance),
        })
      )
  )
  await page.route(
    (url) => url.pathname === "/api/commands/paper.save",
    async (route) => {
      const request = route.request()
      if (request.method() === "OPTIONS")
        return route.fulfill(answer(request, { status: 204 }))
      const input = request.postDataJSON().input
      if (input.update) {
        Y.applyUpdate(remote, Buffer.from(input.update, "base64"))
        revision += 1
      }
      return route.fulfill(
        answer(request, {
          status: 200,
          json: {
            ok: true,
            data: {
              provenance: fixture.provenance,
              epoch: 1,
              revision,
              reset: input.epoch === 0,
              stale: false,
              update: Buffer.from(Y.encodeStateAsUpdate(remote)).toString(
                "base64"
              ),
              stateVector: Buffer.from(Y.encodeStateVector(remote)).toString(
                "base64"
              ),
            },
          },
        })
      )
    }
  )
  page.once("close", () => remote.destroy())
  await page.goto(`${origin}/paper/${ID}`, { waitUntil: "domcontentloaded" })
  await page.locator('.paper-rich-sheet[contenteditable="true"]').waitFor()
}
