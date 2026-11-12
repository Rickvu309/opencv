import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { blankCv, type PaperPages, type PaperView } from "@workspace/domain"

import { PaperCvEditor } from "./paper-cv-editor.tsx"
import { PaperLibrary } from "./paper-library.tsx"
import { PaperTemplateGallery } from "./paper-template-gallery.tsx"
import { PAPER_TEMPLATE_LABELS } from "./paper-templates.ts"
import { panelFit } from "@workspace/ui/lib/dialog-fit"

const record: PaperView = {
  id: "11111111-1111-4111-8111-111111111111",
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
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const pages: PaperPages = {
  docId: record.id,
  pages: 1,
  pageChoice: "unset",
}

function wideDialog() {
  const content = document
    .querySelector("[data-template-gallery]")
    ?.closest("[data-slot='dialog-content']")
  expect(content?.className).toContain("sm:max-w-3xl")
  expect(content?.className).toContain("overflow-y-auto")
  expect(content?.className).not.toContain("sm:max-w-sm")
  for (const window of GALLERY_WINDOWS)
    expect(
      panelFit(content!.className, window).problems,
      `${window.width}x${window.height}`
    ).toEqual([])
  const actions = content!.querySelector("[data-slot=paper-gallery-actions]")
  expect(actions?.className).toContain("sticky")
  expect(actions?.className).toContain("-bottom-6")
  expect(
    actions
      ?.querySelector("button")
      ?.closest("[data-slot=paper-gallery-actions]")
  ).toBe(actions)
}

const GALLERY_WINDOWS = [
  { width: 390, height: 844 },
  { width: 390, height: 560 },
  { width: 600, height: 480 },
  { width: 820, height: 512 },
  { width: 1024, height: 700 },
  { width: 1440, height: 900 },
]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Paper template gallery", () => {
  it("lists the sixteen templates and maps preview layouts", () => {
    const view = render(
      <PaperTemplateGallery
        onUse={() => undefined}
        onImport={() => undefined}
      />
    )

    for (const item of PAPER_TEMPLATE_LABELS) {
      expect(
        screen.getByRole("button", { name: item.label })
      ).toBeInTheDocument()
    }
    expect(PAPER_TEMPLATE_LABELS).toHaveLength(16)

    function preview(label: string) {
      fireEvent.click(screen.getByRole("button", { name: label }))
      return view.container
        .querySelector("[data-template]")
        ?.getAttribute("data-template")
    }

    expect(preview("Simple")).toBe("simple")
    expect(preview("Modern")).toBe("modern")
    expect(preview("Compact")).toBe("compact")
    expect(preview("Academic")).toBe("academic")
    expect(preview("With photo")).toBe("with-photo")
    expect(preview("Bold")).toBe("simple")
    expect(
      view.container.querySelector("[data-template-list]")?.className
    ).toContain("flex-col")
    expect(
      view.container.querySelector("[data-template-list]")?.className
    ).toContain("@min-[391px]:flex-row")
    expect(
      view.container.querySelector("[data-template-gallery]")?.className
    ).toContain("grid-cols-1")
    expect(
      view.container.querySelector("[data-template-gallery]")?.className
    ).toContain("@min-[391px]:grid-cols-2")
  })

  it("gives the dialog a wide frame that fits every window size and scrolls inside it, with its actions pinned in view", () => {
    const library = render(
      <PaperLibrary
        docs={[record]}
        files={[]}
        loading={false}
        error={null}
        onRetry={() => undefined}
        onOpen={() => undefined}
        query=""
        onQueryChange={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "New" }))
    const kindDialog = document.querySelector("[data-slot='dialog-content']")
    expect(kindDialog?.className).toContain("sm:max-w-sm")
    expect(kindDialog?.className).not.toContain("sm:max-w-3xl")
    fireEvent.click(screen.getByRole("button", { name: "CV" }))
    wideDialog()
    library.unmount()

    vi.stubGlobal(
      "fetch",
      () =>
        Promise.resolve(
          Response.json({ ok: true, data: {} })
        ) as Promise<Response>
    )
    render(
      <ChatStoreProvider>
        <PaperCvEditor
          initial={record}
          pages={pages}
          onBack={() => undefined}
        />
      </ChatStoreProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Change template" }))
    wideDialog()
  })
})
