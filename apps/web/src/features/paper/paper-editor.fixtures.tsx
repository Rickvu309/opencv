import type { ReactElement } from "react"
import { parsePaperId } from "@workspace/domain/kernel"
import { blankCv, type PaperView } from "@workspace/domain/paper-doc"
import { Toaster } from "@workspace/ui/components/sonner"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { render as renderWithClient } from "@/test/render-with-client.tsx"

export function render(ui: ReactElement) {
  const wrap = (content: ReactElement) => (
    <ChatStoreProvider>
      {content}
      <Toaster />
    </ChatStoreProvider>
  )
  const view = renderWithClient(wrap(ui))
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(wrap(next)),
  }
}

export const record: PaperView = {
  id: parsePaperId("11111111-1111-7111-8111-111111111111"),
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  paper: blankCv(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

export function inputOf<T>(init?: RequestInit) {
  return (JSON.parse(String(init?.body)) as { input: T }).input
}

export function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

export function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}
