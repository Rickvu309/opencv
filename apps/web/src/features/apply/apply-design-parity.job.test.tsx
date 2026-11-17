import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  APM_ID,
  CONTENT_ID,
  LUMIERE,
  PEN_FRAME_CLOCK,
  addLetters,
  detailJobs,
  fill,
  penJobs,
  setDeadline,
} from "@/test/apply-pen-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { expectFrame, main } from "@/test/pen-frame-text.ts"
import { renderApp } from "@/test/render-app.tsx"

import newJob from "./design/w9-2-new-job.snapshot.json"
import newJobStyles from "./design/w9-2-new-job.styles.json"
import filledIn from "./design/w10-1-filled-in.snapshot.json"
import filledInStyles from "./design/w10-1-filled-in.styles.json"
import companyMissing from "./design/w10-2-company-missing.snapshot.json"
import companyMissingStyles from "./design/w10-2-company-missing.styles.json"
import duplicate from "./design/w10-3-already-on-board.snapshot.json"
import duplicateStyles from "./design/w10-3-already-on-board.styles.json"
import detail from "./design/w10-4-job-detail.snapshot.json"
import detailStyles from "./design/w10-4-job-detail.styles.json"
import linkPaper from "./design/w10-5-link-from-paper.snapshot.json"
import closed from "./design/w10-6-closed-job.snapshot.json"
import closedStyles from "./design/w10-6-closed-job.styles.json"
import deleteJob from "./design/w10-7-delete-job.snapshot.json"
import deleteJobStyles from "./design/w10-7-delete-job.styles.json"

const FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW: Record<
  string,
  Record<string, string>
> = {
  w104: {
    Subscribe: "the product has no activity subscription",
    "1 / 7":
      "the pager counts the board order (stage, then position), which puts this job 5th",
  },
  w105: {
    Subscribe: "the product has no activity subscription",
    "1 / 7":
      "the pager counts the board order (stage, then position), which puts this job 5th",
  },
  w106: {
    Subscribe: "the product has no activity subscription",
    "Round 2 on Oct 6": "JobView has no interview round or past interview date",
  },
}

const ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE: Record<
  string,
  { count: number; reason: string }
> = {
  detail: {
    count: 1,
    reason: "the note composer paperclip has no behavior",
  },
}

async function openNewJob() {
  fireEvent.click(await screen.findByRole("button", { name: "New job" }))
  return screen.findByRole("dialog", { name: "New job" })
}

async function pasteLink(dialog: HTMLElement, url: string) {
  const link = screen.getByLabelText("Paste the job link")
  fireEvent.change(link, { target: { value: url } })
  fireEvent.blur(link)
  await waitFor(() => {
    expect(screen.getByLabelText("Role title")).not.toHaveValue("")
  })
  return dialog
}

describe("New job and job detail match W9.2 and W10 of opencv.pen at the frame clock, with every frame text and at least as many icons; sizes, weights and colours stay with verify-app-ui", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(PEN_FRAME_CLOCK)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("W9.2 New job", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    const dialog = await openNewJob()
    expectFrame(dialog, newJob, newJobStyles)
  })
  it("W10.1 Filled in", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    const dialog = await pasteLink(await openNewJob(), LUMIERE)
    await setDeadline("2026-11-15")
    expectFrame(dialog, filledIn, filledInStyles)
  })
  it("W10.2 Company missing", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    const dialog = await pasteLink(await openNewJob(), LUMIERE)
    await setDeadline("2026-11-15")
    const deadline = screen.getByRole("dialog", { name: "Deadline" })
    fireEvent.keyDown(within(deadline).getByLabelText("Deadline"), {
      key: "Escape",
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Deadline" })
      ).not.toBeInTheDocument()
    })
    fill("Company", "")
    fill(
      "Add the job description",
      "Plan and run social campaigns for three skincare brands. Write short posts and TikTok scripts, and report weekly reach."
    )
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await screen.findByText("Add the company name to save this job.")
    expectFrame(dialog, companyMissing, companyMissingStyles)
  })
  it("W10.3 Already on your board", async () => {
    setMockJobs(
      penJobs({
        "Associate PM intern": {
          jobUrl: "https://itviec.com/it-jobs/apm-intern",
        },
      })
    )
    renderApp("/apply")
    const dialog = await openNewJob()
    const link = screen.getByLabelText("Paste the job link")
    fireEvent.change(link, {
      target: { value: "https://itviec.com/it-jobs/apm-intern" },
    })
    fireEvent.blur(link)
    await screen.findByText("Already on your board")
    expectFrame(dialog, duplicate, duplicateStyles)
  })
  it("W10.4 Job detail", async () => {
    setMockJobs(detailJobs())
    renderApp(`/apply/${APM_ID}`)
    await screen.findByText("Bring the checkout study")
    expectFrame(
      main(),
      detail,
      detailStyles,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w104,
      ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE.detail.count
    )
  })
  it("W10.5 Link from Paper", async () => {
    setMockJobs(detailJobs())
    addLetters()
    renderApp(`/apply/${APM_ID}`)
    fireEvent.click(
      await screen.findByRole("button", { name: "Add cover letter" })
    )
    await screen.findByText("Cover letter, Lumière")
    expectFrame(
      document.body,
      linkPaper,
      null,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w105
    )
  })
  it("W10.6 Closed job", async () => {
    setMockJobs(detailJobs())
    renderApp(`/apply/${CONTENT_ID}`)
    await screen.findByText("Comfortable with short deadlines")
    expectFrame(
      main(),
      closed,
      closedStyles,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w106,
      ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE.detail.count
    )
  })
  it("W10.7 Delete job", async () => {
    setMockJobs(detailJobs())
    renderApp(`/apply/${APM_ID}`)
    fireEvent.click(await screen.findByRole("button", { name: "More" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete job" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete Associate PM intern?",
    })
    expectFrame(dialog, deleteJob, deleteJobStyles)
  })
})
