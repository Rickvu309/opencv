import { afterEach, beforeAll, beforeEach, expect, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import {
  isCvDocument,
  PAPER_CONTENT_VERSION,
  STARTER_CV_NAME,
  starterCvDocument,
} from "@workspace/domain"
import type { JobStage } from "@/features/apply/apply-api.ts"
import { ownedCvName } from "@/features/paper/paper-data.ts"
import { TEST_SESSION_USER } from "@/test/auth-client-mock.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { resetMockJobs, setMockJobs } from "@/test/apply-jobs-mock.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { goHome } from "@/test/go-home.ts"
import { renderApp } from "@/test/render-app.tsx"

export function coachFloatButton() {
  const editor = screen.queryByRole("region", { name: /^Editing / })
  const scope = editor instanceof HTMLElement ? editor : document.body
  const button = within(scope).queryByRole("button", { name: "Coach" })
  if (!(button instanceof HTMLElement)) {
    throw new Error("Coach button is missing")
  }
  return button
}

export function renderPaper() {
  return renderApp(SURFACE_PATHS.paper)
}

export async function openDoc(name: string) {
  const card = await screen.findByRole("button", {
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`),
  })
  fireEvent.click(card)
  const editor = await screen.findByRole("region", { name: `Editing ${name}` })
  expect(editor).toBeInTheDocument()
  return editor
}

export const SEEDED_SAMPLE_CV_ID = "66666666-6666-7666-8666-666666666666"

export function ownedSampleCvName() {
  return ownedCvName(TEST_SESSION_USER.name)
}

export function starterSampleCvDoc() {
  return {
    id: SEEDED_SAMPLE_CV_ID,
    name: STARTER_CV_NAME,
    kind: "cv" as const,
    status: "draft" as const,
    content: starterCvDocument(),
    contentVersion: PAPER_CONTENT_VERSION,
    applyCardId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function seedSampleInternshipCv() {
  getMockPaperDocs().unshift(starterSampleCvDoc())
}

export function seedStarterPaperDrive() {
  const docs = getMockPaperDocs()
  docs.splice(0, docs.length, starterSampleCvDoc())
}

export function sampleInternshipCv() {
  const cv =
    getMockPaperDocs().find((doc) => doc.id === SEEDED_SAMPLE_CV_ID) ??
    getMockPaperDocs().find((doc) => doc.name === STARTER_CV_NAME)
  expect(cv && isCvDocument(cv.content)).toBe(true)
  if (!cv || !isCvDocument(cv.content)) {
    throw new Error("Sample internship CV is missing")
  }
  return cv
}

export function sampleSkillItems() {
  return sampleInternshipCv().content.skills.flatMap((group) => group.items)
}

export async function goHomeThenPaper() {
  await goHome()
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: "How can I help?",
    })
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole("link", { name: /^Paper$/ }))
  await expectPaperDrive()
}

export function coachDialog() {
  return screen.getByRole("dialog", { name: "Coach" })
}

export async function openCoach() {
  fireEvent.click(coachFloatButton())
  const dialog = await screen.findByRole("dialog", { name: "Coach" })
  await within(dialog).findByRole("textbox", { name: "Message Coach" })
  return dialog
}

export function messageCoach(container: HTMLElement = coachDialog()) {
  return within(container).getByRole("textbox", { name: "Message Coach" })
}

export function selectNodeContents(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  document.dispatchEvent(new Event("selectionchange"))
}

export function collapseWindowSelection() {
  window.getSelection()?.removeAllRanges()
  document.dispatchEvent(new Event("selectionchange"))
}

export function stubDesktopViewport(isDesktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY ? isDesktop : true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

export function queryByAttr(root: ParentNode, selector: string) {
  return root.querySelector(`[${selector}]`)
}

function releaseStage(stage: string): JobStage {
  if (stage === "inbox") return "saved"
  if (stage === "prep") return "applied"
  if (stage === "sent") return "interview"
  if (stage === "live") return "offer"
  return "closed"
}

export function installPaperTestLifecycle() {
  beforeAll(async () => {
    await import("@/features/coach/coach-thread.tsx")
  }, 60_000)

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.stubGlobal("scrollTo", vi.fn())
    setMockJobs(
      sampleApplyCards().map((card) =>
        mockJob({
          id: card.id,
          title: card.title,
          company: card.company,
          stage: releaseStage(card.stage),
          position: card.position,
          starred: card.starred,
          jobUrl: card.jobUrl,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        })
      )
    )
  })

  afterEach(() => {
    resetMockJobs()
    cleanup()
    sessionStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
  })
}
