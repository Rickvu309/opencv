const API = "https://backboard.railway.com/graphql/v2"
const QUEUE_BOT = "github-merge-queue[bot]"
const IDLE = new Set(["SKIPPED", "REMOVED"])

// Per service, only the newest deployment that is not skipped or replaced may be approved, so an older held release can never roll the site back.
export function pickApprovals(deployments, { repo }) {
  const newestFirst = [...deployments].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  const seen = new Set()
  const picks = []
  for (const deployment of newestFirst) {
    if (IDLE.has(deployment.status) || seen.has(deployment.serviceId)) continue
    seen.add(deployment.serviceId)
    const { meta } = deployment
    if (
      deployment.status === "NEEDS_APPROVAL" &&
      meta?.branch === "main" &&
      meta?.commitAuthor === QUEUE_BOT &&
      meta?.repo?.toLowerCase() === repo.toLowerCase()
    )
      picks.push(deployment)
  }
  return picks
}

async function call(token, query, variables) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Project-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = await response.json()
  if (!response.ok || body.errors)
    throw new Error(
      `Railway request failed: ${body.errors?.[0]?.message ?? response.status}`
    )
  return body.data
}

const LIST = `query($input: DeploymentListInput!) {
  deployments(input: $input, first: 40) { edges { node { id status serviceId createdAt meta } } }
}`

async function main() {
  const { RAILWAY_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA } = process.env
  if (!RAILWAY_TOKEN || !GITHUB_REPOSITORY || !GITHUB_SHA)
    throw new Error("Set RAILWAY_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA.")
  const { projectToken } = await call(
    RAILWAY_TOKEN,
    "{ projectToken { projectId environmentId } }"
  )
  const approved = new Set()
  for (let round = 1; round <= 9; round++) {
    const data = await call(RAILWAY_TOKEN, LIST, { input: projectToken })
    const deployments = data.deployments.edges
      .map((edge) => edge.node)
      .filter((node) => node.meta?.repo)
    for (const pick of pickApprovals(deployments, {
      repo: GITHUB_REPOSITORY,
    })) {
      if (approved.has(pick.id)) continue
      await call(
        RAILWAY_TOKEN,
        "mutation($id: String!) { deploymentApprove(id: $id) }",
        { id: pick.id }
      )
      approved.add(pick.id)
      console.log(
        `approved ${pick.id} for service ${pick.serviceId} at ${pick.meta.commitHash}`
      )
    }
    const services = new Set(deployments.map((node) => node.serviceId))
    const reached = new Set(
      deployments
        .filter((node) => node.meta.commitHash === GITHUB_SHA)
        .map((node) => node.serviceId)
    )
    if (reached.size >= services.size) break
    await new Promise((resolve) => setTimeout(resolve, 20_000))
  }
  console.log(`approved ${approved.size} deployment(s)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
