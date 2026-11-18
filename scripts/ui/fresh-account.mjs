import {
  LIBRARY_READS,
  libraryFrom,
  markUsed,
  poolPaths,
  processAlive,
  realPoolStore,
  takeAccount,
  untouchedProblem,
} from "./account-pool.mjs"
import { viewportFor } from "./screens.mjs"

export function contextOptions({ width, scale = 1, colorScheme }) {
  return {
    viewport: viewportFor(width),
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    ...(colorScheme ? { colorScheme } : {}),
  }
}

const sayOnce = (line) => process.stderr.write(`${line}\n`)

export async function signInFresh(
  context,
  state,
  screenId,
  store = realPoolStore()
) {
  const paths = poolPaths(state.dir)
  const account = await takeAccount(store, paths, {
    fillerAlive: () => processAlive(state.pool?.pid),
    onEmpty: sayOnce,
  })
  markUsed(store, paths, account, screenId)
  await context.addCookies(account.cookies)
  const headers = { origin: state.webOrigin }
  const bodies = {}
  for (const [kind, path] of Object.entries(LIBRARY_READS)) {
    const read = await context.request.get(`${state.apiOrigin}${path}`, {
      headers,
    })
    if (read.status() !== 200)
      throw new Error(`${screenId}: ${path} failed with ${read.status()}`)
    bodies[kind] = await read.json()
  }
  const problem = untouchedProblem(account, libraryFrom(bodies))
  if (problem) throw new Error(`${screenId}: ${problem}`)
  return account.email
}
