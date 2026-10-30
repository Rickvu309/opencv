import type { JobView } from "@workspace/domain"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"
import snapshot from "./design/letter-start.snapshot.json"
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
  expect(screen.getByPlaceholderText(texts[4])).toHaveFocus()
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
