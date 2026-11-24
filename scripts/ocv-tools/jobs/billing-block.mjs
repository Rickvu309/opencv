import { json } from "./common.mjs"

const CI_PATH = ".github/workflows/ci.yml"
const BILLING =
  /recent account payments have failed|spending limit needs to be increased/i
const BILLING_JOBS_READ = 3

function stepless(jobs) {
  return jobs.length > 0 && jobs.every((job) => (job.steps ?? []).length === 0)
}

function billingNote(ctx, repo, jobs) {
  const idle = jobs.filter((job) => (job.steps ?? []).length === 0)
  for (const job of idle.slice(0, BILLING_JOBS_READ)) {
    let notes = []
    try {
      notes = json(
        ctx,
        "api",
        `repos/${repo}/check-runs/${job.id}/annotations?per_page=10`
      )
    } catch {
      continue
    }
    const hit = (Array.isArray(notes) ? notes : []).find((note) =>
      BILLING.test(note.message ?? "")
    )
    if (hit) return hit.message
  }
  return null
}

function newestFailedPullRun(ctx, repo, head) {
  const runs =
    json(ctx, "api", `repos/${repo}/actions/runs?head_sha=${head}&per_page=20`)
      .workflow_runs ?? []
  return runs
    .filter(
      (run) =>
        run.path === CI_PATH &&
        run.status === "completed" &&
        run.conclusion === "failure" &&
        run.event === "pull_request"
    )
    .sort((a, b) => b.id - a.id)[0]
}

export function billingOfPullRun(ctx, repo, head) {
  const run = newestFailedPullRun(ctx, repo, head)
  if (!run) return null
  const jobs =
    json(ctx, "api", `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`)
      .jobs ?? []
  if (!stepless(jobs)) return null
  const message = billingNote(ctx, repo, jobs)
  return message ? { runId: run.id, message } : null
}
