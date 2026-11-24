import { undoneActivityRow } from "@/test/control-fixtures.ts"
import { useReducer } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { blankCv, emptyCvDocument, type PaperView } from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"
import { structuredCv } from "@/test/paper-structured-cv.ts"
import { Toaster } from "@workspace/ui/components/sonner"

import { CvDocument } from "./cv-print-document.tsx"
import { CvPhoto, CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { PaperSharePage } from "./paper-share-page.tsx"
import {
  CV_PHOTO_SIZE_REJECTION,
  CV_PHOTO_TYPE_REJECTION,
} from "./paper-api.ts"

const FILE_ID = "11111111-1111-4111-8111-111111111111"
const DOC_ID = "22222222-2222-4222-8222-222222222222"

const state = vi.hoisted(() => ({ pathname: "/share/tok" }))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (options: {
    select: (routerState: { location: { pathname: string } }) => unknown
  }) => options.select({ location: { pathname: state.pathname } }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  state.pathname = "/share/tok"
})

function photoData() {
  return {
    ...emptyCvDocument(),
    templateId: "photo" as const,
    photoUrl: `file:${FILE_ID}`,
  }
}

function replaceUrl(_: string | undefined, next: string | undefined) {
  return next
}

describe("CV photo", () => {
  it("renders a stored file id as the byte url on the A4 preview", () => {
    const view = render(
      <CvDocument data={photoData()} onChange={() => undefined} />
    )
    const img = view.container.querySelector("img")
    expect(img?.getAttribute("src")).toContain(
      `/api/paper/files/${FILE_ID}/bytes`
    )
    expect(img?.getAttribute("src")).not.toContain("blob:")
    expect(img?.getAttribute("alt")).toBe("Photo")
  })

  it("never stores a blob url and shows the size and type sentences", async () => {
    const created = vi.spyOn(URL, "createObjectURL")
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? "GET"} ${url}`)
      if (url.includes("/api/commands/paper.attachPhoto")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              id: DOC_ID,
              contentVersion: 2,
              activityId: "33333333-3333-4333-8333-333333333333",
              name: "Photo CV",
              kind: "cv",
              templateId: "with-photo",
              status: "draft",
              document: photoData(),
              checks: [],
              pageChoice: "unset",
              sourceFileId: null,
              createdAt: "2020-01-01T00:00:00.000Z",
              updatedAt: "2020-01-01T00:00:00.000Z",
            },
          })
        )
      }
      if (url.includes("/api/paper/files")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { id: FILE_ID } })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })

    function Harness() {
      const [url, setUrl] = useReducer(replaceUrl, undefined)
      return (
        <CvPhotoFrame value={{ docId: DOC_ID }}>
          <CvPhoto url={url} onChange={setUrl} />
        </CvPhotoFrame>
      )
    }
    const view = render(<Harness />)
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    fireEvent.change(input, {
      target: {
        files: [new File(["hello"], "notes.txt", { type: "text/plain" })],
      },
    })
    expect(screen.getByText(CV_PHOTO_TYPE_REJECTION)).toBeInTheDocument()
    expect(created).not.toHaveBeenCalled()
    expect(calls).toEqual([])

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(3_000_000)], "big.png", {
            type: "image/png",
          }),
        ],
      },
    })
    expect(screen.getByText(CV_PHOTO_SIZE_REJECTION)).toBeInTheDocument()
    expect(calls).toEqual([])

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(8)], "face.png", { type: "image/png" }),
        ],
      },
    })
    await waitFor(() => {
      expect(
        view.container.querySelector("img")?.getAttribute("src")
      ).toContain(`/api/paper/files/${FILE_ID}/bytes`)
    })
    expect(created).not.toHaveBeenCalled()
    expect(calls.some((call) => call.includes("blob:"))).toBe(false)
    expect(view.container.innerHTML).not.toContain("blob:")
  })

  it("deletes the uploaded file when attach fails", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? "GET"} ${url}`)
      if (url.includes("/api/commands/paper.attachPhoto")) {
        return Promise.resolve(
          Response.json(
            {
              ok: false,
              error: {
                code: "CONFLICT",
                message: "This document changed. Reload it and try again.",
              },
            },
            { status: 409 }
          )
        )
      }
      if (url.includes("/api/paper/files")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { id: FILE_ID } })
        )
      }
      if (url.includes("/api/commands/paper.deleteFile")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { fileId: FILE_ID } })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })

    function Harness() {
      const [url, setUrl] = useReducer(replaceUrl, undefined)
      return (
        <CvPhotoFrame value={{ docId: DOC_ID }}>
          <CvPhoto url={url} onChange={setUrl} />
        </CvPhotoFrame>
      )
    }
    const view = render(<Harness />)
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(8)], "face.png", { type: "image/png" }),
        ],
      },
    })
    expect(
      await screen.findByText("This document changed. Reload it and try again.")
    ).toBeInTheDocument()
    expect(calls.some((call) => call.includes("paper.deleteFile"))).toBe(true)
    expect(view.container.querySelector("img")).toBeNull()
  })

  it("deletes the uploaded file when the person cancels the attach from the toast", async () => {
    const calls: { url: string; body?: string }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, body: init?.body ? String(init.body) : undefined })
      if (url.includes("/api/commands/paper.attachPhoto")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              id: DOC_ID,
              contentVersion: 2,
              activityId: "33333333-3333-4333-8333-333333333333",
            },
          })
        )
      }
      if (url.includes("/api/commands/activity.undo")) {
        return Promise.resolve(
          Response.json({ ok: true, data: undoneActivityRow() })
        )
      }
      if (url.includes(`/api/paper/${DOC_ID}`)) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              id: DOC_ID,
              contentVersion: 3,
              paper: blankCv(),
            },
          })
        )
      }
      if (url.includes("/api/commands/paper.deleteFile")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { fileId: FILE_ID } })
        )
      }
      if (url.includes("/api/paper/files")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { id: FILE_ID } })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })

    function Harness() {
      const [url, setUrl] = useReducer(replaceUrl, undefined)
      return (
        <>
          <CvPhotoFrame value={{ docId: DOC_ID }}>
            <CvPhoto url={url} onChange={setUrl} />
          </CvPhotoFrame>
          <Toaster />
        </>
      )
    }
    const view = render(<Harness />)
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(8)], "face.png", { type: "image/png" }),
        ],
      },
    })
    await waitFor(() => {
      expect(
        view.container.querySelector("img")?.getAttribute("src")
      ).toContain(`/api/paper/files/${FILE_ID}/bytes`)
    })
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.url.includes("paper.deleteFile") &&
            call.body?.includes(FILE_ID)
        )
      ).toBe(true)
    })
    expect(view.container.querySelector("img")).toBeNull()
  })

  it("stays quiet when delete fails after undo, because the sweep removes the row", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/api/commands/paper.attachPhoto")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              id: DOC_ID,
              contentVersion: 2,
              activityId: "33333333-3333-4333-8333-333333333333",
            },
          })
        )
      }
      if (url.includes("/api/commands/activity.undo")) {
        return Promise.resolve(
          Response.json({ ok: true, data: undoneActivityRow() })
        )
      }
      if (url.includes(`/api/paper/${DOC_ID}`)) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              id: DOC_ID,
              contentVersion: 3,
              paper: blankCv(),
            },
          })
        )
      }
      if (url.includes("/api/commands/paper.deleteFile")) {
        return Promise.resolve(
          Response.json(
            {
              ok: false,
              error: {
                code: "REQUEST_FAILED",
                message: "delete missed the sweep",
              },
            },
            { status: 500 }
          )
        )
      }
      if (url.includes("/api/paper/files")) {
        return Promise.resolve(
          Response.json({ ok: true, data: { id: FILE_ID } })
        )
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })

    function Harness() {
      const [url, setUrl] = useReducer(replaceUrl, undefined)
      return (
        <>
          <CvPhotoFrame value={{ docId: DOC_ID }}>
            <CvPhoto url={url} onChange={setUrl} />
          </CvPhotoFrame>
          <Toaster />
        </>
      )
    }
    const view = render(<Harness />)
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(8)], "face.png", { type: "image/png" }),
        ],
      },
    })
    await waitFor(() => {
      expect(
        view.container.querySelector("img")?.getAttribute("src")
      ).toContain(`/api/paper/files/${FILE_ID}/bytes`)
    })
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => {
      expect(calls.some((url) => url.includes("paper.deleteFile"))).toBe(true)
    })
    await expect(
      screen.findByText("delete missed the sweep", {}, { timeout: 400 })
    ).rejects.toThrow()
    expect(view.container.querySelector("img")).toBeNull()
  })

  it("renders the file id as the public photo on the share page", async () => {
    const paper = structuredCv()
    const shared: Omit<PaperView, "isFavorite"> = {
      id: DOC_ID,
      name: "Photo CV",
      kind: "cv",
      templateId: "with-photo",
      status: "draft",
      paper: {
        ...paper,
        header: {
          ...paper.header,
          name: "Ada Lovelace",
          photo: `file:${FILE_ID}`,
        },
      },
      contentVersion: 2,
      checks: [],
      pageChoice: "unset",
      sourceFileId: null,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok") && !url.includes("/photo")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const view = render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "Photo CV" })
    ).toBeInTheDocument()
    const img = view.container.querySelector("img")
    expect(img?.getAttribute("src")).toContain("/api/paper/shared/tok/photo")
    expect(img?.getAttribute("alt")).toBe("Ada Lovelace")
    expect(view.container.innerHTML).not.toContain("blob:")
  })
})
