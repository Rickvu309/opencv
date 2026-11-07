import { decide, refusalError } from "./rules/index.mjs"

export function validateAuthoring({ n, issue, pull }) {
  const planned = {
    title: `${issue.title} (#${n})`,
    body: `Closes #${n}`,
  }
  for (const metadata of [planned, ...(pull ? [pull] : [])]) {
    const verdict = decide("authoring", {
      pull: { ...metadata, issue: n, issueState: issue.state },
    })
    if (!verdict.ok) throw refusalError(verdict.refusals[0])
  }
}
