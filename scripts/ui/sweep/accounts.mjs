import {
  markUsed,
  poolPaths,
  processAlive,
  realPoolStore,
  takeAccount,
} from "../account-pool.mjs"

export function pooled(
  state,
  {
    store = realPoolStore(),
    say = (line) => process.stderr.write(`${line}\n`),
  } = {}
) {
  const paths = poolPaths(state.dir)
  return {
    take: async (purpose) => {
      const account = await takeAccount(store, paths, {
        fillerAlive: () => processAlive(state.pool?.pid),
        onEmpty: say,
      })
      markUsed(store, paths, account, purpose)
      return { email: account.email, cookies: account.cookies }
    },
  }
}
