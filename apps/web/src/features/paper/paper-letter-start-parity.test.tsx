import { readFileSync } from "node:fs"
import type { JobView } from "@workspace/domain"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import snapshot from "./design/letter-start.snapshot.json"
import unreadableSnapshot from "./design/letter-unreadable.snapshot.json"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"

const { listJobs } = vi.hoisted(() => ({ listJobs: vi.fn() }))
vi.mock("@/features/apply/apply-api.ts", () => ({ listJobs }))

afterEach(cleanup)

it("shows the job picker from its pen frame and lets Paper return to the library", async () => {
  const texts = snapshot.sections.find(
    (section) => section.name === "Main wrap"
  )!.texts
  const jobs: JobView[] = texts.flatMap((text, index) =>
    text.startsWith("@")
      ? [
          {
            id: `job-${index}`,
            title: texts[index - 1],
            company: text.slice(1),
            posting: {},
            cvDocId: null,
            letterDocId: null,
            updatedAt: "2026-08-25T12:00:00.000Z",
          },
        ]
      : []
  )
  listJobs.mockResolvedValue(jobs)
  const onBack = vi.fn()
  render(<PaperLetterStartPage onBack={onBack} onCreated={vi.fn()} />)

  expect(screen.getByRole("heading", { name: texts[3] })).toBeInTheDocument()
  const search = screen.getByRole("textbox")
  expect(search).toHaveAttribute("placeholder", "Search or paste a link")
  expect(search).toHaveAccessibleName(texts[4])
  expect(search).toHaveFocus()
  for (const job of jobs) {
    expect(
      await screen.findByRole("button", {
        name: `${job.title}, ${job.company}`,
      })
    ).toBeInTheDocument()
  }
  expect(screen.getByRole("button", { name: texts[17] })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: texts[18] })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: texts[0] }))
  expect(onBack).toHaveBeenCalledOnce()
})

it("returns to Paper on Escape", () => {
  listJobs.mockResolvedValue([])
  const onBack = vi.fn()
  render(<PaperLetterStartPage onBack={onBack} onCreated={vi.fn()} />)
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })
  expect(onBack).toHaveBeenCalledOnce()
})

it("keeps the Job title and company available when the text grows", async () => {
  listJobs.mockResolvedValue([
    {
      id: "job",
      title: "Product designer",
      company: "Lumiere",
      posting: {},
      cvDocId: null,
      letterDocId: null,
      updatedAt: "2026-08-25T12:00:00.000Z",
    } satisfies JobView,
  ])
  const style = document.createElement("style")
  style.textContent = readFileSync(
    "src/features/paper/design/letter-start.pen.css",
    "utf8"
  )
  document.head.append(style)
  try {
    render(<PaperLetterStartPage onBack={vi.fn()} onCreated={vi.fn()} />)
    const job = await screen.findByRole("button", {
      name: "Product designer, Lumiere",
    })
    const labels = screen.getByText("Product designer").parentElement!
    expect(labels).toContainElement(screen.getByText("Lumiere"))
    expect(getComputedStyle(labels).flexWrap).toBe("wrap")
    expect(getComputedStyle(labels).whiteSpace).toBe("normal")
    expect(getComputedStyle(job).height).toBe("auto")
  } finally {
    style.remove()
  }
})

it("shows the unreadable-link copy from its own pen frame", async () => {
  listJobs.mockResolvedValue([])
  render(<PaperLetterStartPage onBack={vi.fn()} onCreated={vi.fn()} />)
  const texts = unreadableSnapshot.sections.find(
    (section) => section.name === "Main wrap"
  )!.texts
  const link = texts.find((text) => text.startsWith("linkedin.com/"))!
  fireEvent.change(screen.getByRole("textbox"), { target: { value: link } })
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Can't read this link"
  )
  expect(
    document.querySelector('[data-slot="letter-unreadable-icon"]')
  ).toBeInTheDocument()
  expect(screen.getByText(texts[5])).toBeInTheDocument()
  expect(screen.getByText(texts[6])).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Draft letter" })).toBeDisabled()
})
