import { blockSchema, type Document } from "@workspace/domain/paper-doc"

import { createTestApp, testWebOrigin } from "../test/harness.js"

export const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

export function imageFile(bytes: Uint8Array, name: string, type = "image/png") {
  return new File([bytes], name, { type })
}

function formFile(bytes: Uint8Array, name: string, type: string) {
  const form = new FormData()
  form.set("file", imageFile(bytes, name, type))
  return form
}

export function postAvatar(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  bytes: Uint8Array,
  name: string,
  type: string
) {
  return app.request("/api/paper/files", {
    method: "POST",
    headers: { Origin: testWebOrigin, Cookie: cookie },
    body: formFile(bytes, name, type),
  })
}

export function pageWithPhoto(page: Document, fileId: string): Document {
  return {
    ...page,
    content: [
      ...page.content,
      blockSchema.parse({
        type: "image",
        attrs: {
          id: "photo-1",
          fileId,
          widthMpt: 72000,
          heightMpt: 72000,
          align: "left",
          alt: "Photo",
        },
      }),
    ],
  }
}
