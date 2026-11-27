import { jobViewSchema, type JobView } from "@workspace/domain/apply"
import type { z } from "zod"

export function mockJob(
  patch: Partial<z.input<typeof jobViewSchema>> = {}
): JobView {
  return jobViewSchema.parse({
    id: "01900000-0000-7000-8000-000000000010",
    title: "Junior Marketing",
    company: "Lumière Cosmetics",
    stage: "saved",
    position: "a0",
    location: "Hanoi",
    priority: "normal",
    jobUrl: null,
    sourceHost: null,
    description: "",
    posting: null,
    interviewAt: null,
    deadline: null,
    recruiterName: null,
    recruiterEmail: null,
    cvDocId: null,
    letterDocId: null,
    starred: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  })
}
