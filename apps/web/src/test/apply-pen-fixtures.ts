import { fireEvent, screen } from "@testing-library/react"

import type { JobView } from "@workspace/domain"

import { mockJob } from "@/test/apply-job-fixtures.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"

// The jobs, papers and activity opencv.pen's W9 and W10 frames draw, at the
// frames' clock: Sunday 25 October 2026, 09:00 in Ho Chi Minh City.
export const NOW = new Date("2026-10-25T09:00:00+07:00")
export const at = (iso: string) => new Date(iso).toISOString()
export const day = (ymd: string) => at(`${ymd}T09:00:00+07:00`)

export function penJobs(
  patches: Record<string, Partial<JobView>> = {}
): JobView[] {
  const jobs: JobView[] = [
    mockJob({
      id: "01900000-0000-7000-8000-000000000101",
      title: "Junior Marketing",
      company: "Lumière Cosmetics",
      stage: "saved",
      position: "a0",
      location: "HCMC",
      priority: "high",
      createdAt: day("2026-10-25"),
      updatedAt: day("2026-10-25"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000102",
      title: "UX research intern",
      company: "Agency",
      stage: "saved",
      position: "a1",
      location: "Hanoi",
      deadline: "2026-11-08",
      createdAt: day("2026-10-22"),
      updatedAt: day("2026-10-22"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000103",
      title: "Business analyst intern",
      company: "Regional bank",
      stage: "applied",
      position: "a0",
      location: "HCMC",
      priority: "high",
      createdAt: day("2026-10-14"),
      updatedAt: day("2026-10-14"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000104",
      title: "Marketing intern",
      company: "E-commerce co.",
      stage: "applied",
      position: "a1",
      location: "Remote",
      priority: "low",
      createdAt: day("2026-10-21"),
      updatedAt: day("2026-10-21"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000105",
      title: "Associate PM intern",
      company: "Local startup",
      stage: "interview",
      position: "a0",
      location: "Hanoi",
      priority: "high",
      interviewAt: at("2026-10-29T10:00:00+07:00"),
      createdAt: day("2026-10-12"),
      updatedAt: day("2026-10-20"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000106",
      title: "Product analyst intern",
      company: "E-commerce co.",
      stage: "interview",
      position: "a1",
      location: "Remote",
      priority: "low",
      interviewAt: at("2026-11-03T14:00:00+07:00"),
      createdAt: day("2026-10-02"),
      updatedAt: day("2026-10-02"),
    }),
    mockJob({
      id: "01900000-0000-7000-8000-000000000107",
      title: "Content intern",
      company: "Agency",
      stage: "closed",
      position: "a0",
      location: "Hanoi",
      priority: "low",
      createdAt: day("2026-09-20"),
      updatedAt: day("2026-10-09"),
    }),
  ]
  return jobs.map((job) => ({ ...job, ...patches[job.title] }))
}

export function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

export async function setDeadline(ymd: string) {
  fireEvent.click(screen.getByRole("button", { name: "Deadline" }))
  fireEvent.change(await screen.findByLabelText("Deadline"), {
    target: { value: ymd },
  })
}

export const LUMIERE = "https://topcv.vn/viec-lam/junior-marketing-lumiere"

export const APM_ID = "01900000-0000-7000-8000-000000000105"
export const CONTENT_ID = "01900000-0000-7000-8000-000000000107"
export const CV = {
  id: "01900000-0000-7000-8000-000000000201",
  name: "Junior Marketing CV",
}

export function row(id: string, subject: string, ymd: string, summary: string) {
  return {
    id,
    createdAt: day(ymd),
    actor: "person",
    command: "job.update",
    subjectKind: "job",
    subjectId: subject,
    summary,
    undoneAt: null,
    reversible: false,
  }
}

export function signInAsLinh() {
  setMockSession({
    user: { ...TEST_SESSION_USER, name: "Linh Nguyen" },
    session: { ...TEST_SESSION },
  })
}

export function detailJobs() {
  signInAsLinh()
  const [jm, ux, ba, mi, apm, pa, content] = penJobs({
    "Associate PM intern": {
      jobUrl: "https://itviec.com/it-jobs/apm-intern",
      sourceHost: "itviec.com",
      recruiterName: "Minh Tran",
      cvDocId: CV.id,
      posting: {
        about:
          "Join a 12-person team building a savings app for students. You will own small features from idea to launch.",
        duties:
          "Run user interviews and turn notes into clear problems\nWrite short specs with two engineers\nTrack what changed after each release",
        requirements:
          "Final-year student or recent graduate\nClear writing in English and Vietnamese\nCurious about how people manage money",
        details:
          "6-month internship, starting January\nHybrid in Hanoi, 3 days in the office\nPaid, 6 to 8 million VND a month",
      },
    },
    "Content intern": {
      jobUrl: "https://topcv.vn/viec-lam/content-intern",
      sourceHost: "topcv.vn",
      recruiterName: "Lan Pham",
      cvDocId: CV.id,
      posting: {
        about:
          "Write for agency clients in beauty and food, from blog posts to social captions.",
        duties:
          "Draft two blog posts a week\nWrite captions for client social channels\nJoin client calls and take notes",
        requirements:
          "Strong writing in Vietnamese\nA few published samples\nComfortable with short deadlines",
        details:
          "4-month internship\nOn site in Hanoi\nPaid, 5 million VND a month",
      },
    },
  })
  return [
    jm,
    ux,
    ba,
    mi,
    {
      ...apm,
      checklist: [
        ["Read about their savings app", true],
        ["Practise three PM questions", false],
        ["Bring the checkout study", false],
      ].map(([label, done], index) => ({
        id: `01900000-0000-7000-8000-00000000030${index}`,
        label: label as string,
        done: done as boolean,
        position: `a${index}`,
      })),
      linked: { cv: CV, letter: null },
      activity: [
        row("a1", APM_ID, "2026-10-10", "You added this job from ITviec"),
        {
          ...row("a2", APM_ID, "2026-10-12", "You linked Junior Marketing CV"),
          command: "job.linkPaper",
        },
        row("a3", APM_ID, "2026-10-20", "You moved it to Interview"),
        {
          ...row(
            "a4",
            APM_ID,
            "2026-10-21",
            "Minh likes concrete numbers. Bring the checkout study."
          ),
          command: "job.addNote",
        },
      ],
    },
    pa,
    {
      ...content,
      linked: { cv: CV, letter: null },
      activity: [
        row("c1", CONTENT_ID, "2026-09-20", "Added from TopCV"),
        row("c2", CONTENT_ID, "2026-10-06", "Round 2 interview"),
        row("c3", CONTENT_ID, "2026-10-09", "Closed, not selected"),
        {
          ...row(
            "c4",
            CONTENT_ID,
            "2026-10-09",
            "What I learned: the writing test went well. Next time, bring a sharper story with numbers."
          ),
          command: "job.addNote",
        },
      ],
    },
  ]
}

export function addLetters() {
  const docs = getMockPaperDocs()
  const base = docs.find((doc) => doc.kind === "letter") ?? docs[0]
  if (!base) throw new Error("the paper mock has no documents")
  docs.push(
    {
      ...structuredClone(base),
      id: "01900000-0000-7000-8000-000000000211",
      kind: "letter",
      name: "Cover letter, Local startup",
      status: "draft",
      updatedAt: day("2026-10-21"),
    },
    {
      ...structuredClone(base),
      id: "01900000-0000-7000-8000-000000000212",
      kind: "letter",
      name: "Cover letter, Lumière",
      status: "ready",
      updatedAt: day("2026-10-18"),
    }
  )
}
