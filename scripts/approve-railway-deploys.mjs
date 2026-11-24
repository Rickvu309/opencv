const API = "https://backboard.railway.com/graphql/v2"
const IDLE = new Set(["SKIPPED", "REMOVED"])

export function pickApprovals(deployments, { repo, sha }) {
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
      typeof sha === "string" &&
      sha.length > 0 &&
      meta?.commitHash === sha &&
      deployment.status === "NEEDS_APPROVAL" &&
      meta?.branch === "main" &&
      meta?.repo?.toLowerCase() === repo.toLowerCase()
    )
      picks.push(deployment)
  }
  return picks
}

async function call(token, query, variables, fetchImpl) {
  const response = await fetchImpl(API, {
    signal: AbortSignal.timeout(15_000),
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

export async function runApprovals({
  env = process.env,
  fetchImpl = fetch,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
} = {}) {
  const { RAILWAY_TOKEN, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA } = env
  if (!RAILWAY_TOKEN || !GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_SHA)
    throw new Error(
      "Set RAILWAY_TOKEN, GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA."
    )
  const currentMain = async () => {
    const response = await fetchImpl(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/main`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!response.ok)
      throw new Error(`Cannot verify current main: GitHub ${response.status}`)
    const body = await response.json()
    if (typeof body.sha !== "string" || !body.sha)
      throw new Error("Cannot verify current main: missing SHA")
    if (body.sha !== GITHUB_SHA) {
      log(
        `superseded run ${GITHUB_SHA}; current main is ${body.sha}; no approval`
      )
      return false
    }
    return true
  }
  if (!(await currentMain())) return
  const { projectToken } = await call(
    RAILWAY_TOKEN,
    "{ projectToken { projectId environmentId } }",
    undefined,
    fetchImpl
  )
  const approved = new Set()
  for (let round = 1; round <= 9; round++) {
    const data = await call(
      RAILWAY_TOKEN,
      LIST,
      { input: projectToken },
      fetchImpl
    )
    const deployments = data.deployments.edges
      .map((edge) => edge.node)
      .filter((node) => node.meta?.repo)
    for (const pick of pickApprovals(deployments, {
      repo: GITHUB_REPOSITORY,
      sha: GITHUB_SHA,
    })) {
      if (approved.has(pick.id)) continue
      if (!(await currentMain())) return
      await call(
        RAILWAY_TOKEN,
        "mutation($id: String!) { deploymentApprove(id: $id) }",
        { id: pick.id },
        fetchImpl
      )
      approved.add(pick.id)
      log(
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
    await pause(20_000)
  }
  log(`approved ${approved.size} deployment(s)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runApprovals().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
