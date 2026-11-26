import { useReducer, type ReactNode } from "react"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { parsePaperId } from "@workspace/domain/kernel"
import {
  blankCv,
  paperDocumentSchema,
  type PaperFile,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { render } from "@/test/render-with-client.tsx"
import { PaperLibrary } from "./paper-library.tsx"

export function createLibraryRouter() {
  const root = createRootRoute()
  const proofs = createRoute({
    getParentRoute: () => root,
    path: "/proofs",
    component: () => null,
  })
  const apply = createRoute({
    getParentRoute: () => root,
    path: "/apply",
    component: () => null,
  })
  return createRouter({
    routeTree: root.addChildren([proofs, apply]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
}

export function libraryRouter(children: ReactNode) {
  return (
    <RouterContextProvider router={createLibraryRouter()}>
      {children}
    </RouterContextProvider>
  )
}

export function letterPaper(lines: string[]): PaperView["paper"] {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    clashes: [],
    blocks: lines.map((text, index) => ({
      id: `l-${index + 1}`,
      type: "paragraph",
      content: [{ text }],
    })),
  })
}

export function cv(name: string): PaperView {
  return {
    id: parsePaperId("11111111-1111-4111-8111-111111111111"),
    name,
    kind: "cv",
    templateId: "simple",
    status: "draft",
    paper: blankCv(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  }
}

export function letter(name: string): PaperView {
  return {
    ...cv(name),
    id: parsePaperId("22222222-2222-4222-8222-222222222222"),
    kind: "letter",
    templateId: null,
    paper: letterPaper(["A cover letter."]),
    preview: ["A cover letter."],
  }
}

export function renderLibrary(docs: PaperView[], files: PaperFile[] = []) {
  function Harness() {
    const [router] = useReducer(
      (current: ReturnType<typeof createLibraryRouter>) => current,
      undefined,
      () => createLibraryRouter()
    )
    const [query, setQuery] = useReducer(
      (_query: string, nextQuery: string) => nextQuery,
      ""
    )
    return (
      <RouterContextProvider router={router}>
        <PaperLibrary
          docs={docs}
          files={files}
          loading={false}
          error={null}
          onRetry={() => undefined}
          onOpen={() => undefined}
          query={query}
          onQueryChange={setQuery}
        />
      </RouterContextProvider>
    )
  }
  render(<Harness />)
}
