import { json, gh } from "./common.mjs"

const CI_PATH = ".github/workflows/ci.yml"

export function stepless(jobs) {
  return jobs.length > 0 && jobs.every((job) => (job.steps ?? []).length === 0)
}

function newestFailedRun(runs, matches) {
  return runs
    .filter(
      (r) =>
        r.path === CI_PATH &&
        r.status === "completed" &&
        r.conclusion === "failure" &&
        matches(r)
    )
    .sort((a, b) => b.id - a.id)[0]
}

export function steplessRun(ctx, repo, verdict, n, head) {
  const merge = verdict.kind === "LEFT_QUEUE"
  const query = merge
    ? "event=merge_group&per_page=30"
    : `head_sha=${head}&per_page=20`
  const runs =
    json(ctx, "api", `repos/${repo}/actions/runs?${query}`).workflow_runs ?? []
  const run = newestFailedRun(runs, (r) =>
    merge
      ? String(r.head_branch).startsWith(`gh-readonly-queue/main/pr-${n}-`)
      : r.event === "pull_request"
  )
  if (!run) return null
  const jobs =
    json(ctx, "api", `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`)
      .jobs ?? []
  return stepless(jobs) ? { id: run.id, jobs: jobs.length, merge } : null
}

export function rerunFailed(ctx, run) {
  gh(ctx, "run", "rerun", String(run.id), "--failed")
  return `Infra: run ${run.id} ran no step in any of its ${run.jobs} jobs, so it was rerun once with gh run rerun --failed.`
}
