import { dataOf, type Person } from "./person.test-support.js"

export type Job = {
  id: string
  title: string
  company: string
  stage: string
  position: string
  location: string | null
  priority: string
  jobUrl: string | null
  sourceHost: string | null
  description: string | null
  interviewAt: string | null
  deadline: string | null
  recruiterName: string | null
  cvDocId: string | null
  letterDocId: string | null
  starred: boolean
  activityId?: string | null
}

export type Detail = Job & {
  note: string
  checklist: { id: string; label: string; done: boolean; position: string }[]
  linked: {
    cv: { id: string; name: string } | null
    letter: { id: string; name: string } | null
  }
}

export type Item = { id: string; jobId: string; activityId?: string | null }

export async function saved(
  person: Person,
  input: Record<string, unknown> = {}
) {
  return dataOf<Job>(
    await person.run("job.create", {
      title: "Intern",
      company: "Northwind",
      ...input,
    })
  )
}

export async function jobOf(person: Person, jobId: string) {
  return dataOf<Detail>(await person.get(`/api/jobs/${jobId}`))
}

export async function board(person: Person) {
  return dataOf<Job[]>(await person.get("/api/jobs"))
}

export async function paper(
  person: Person,
  kind: "cv" | "letter",
  name: string
) {
  return dataOf<{ id: string }>(
    await person.run("paper.create", { kind, name })
  )
}
