import { join } from "node:path"

import {
  markUsed,
  poolPaths,
  processAlive,
  realPoolStore,
  takeAccount,
} from "../account-pool.mjs"
import { cookiesFromSetCookie, seededPaths } from "../stack.mjs"

export const ACCOUNT_SOURCES = ["seeded", "pooled"]

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

export function seeded(state, { store = realPoolStore() } = {}) {
  const paths = seededPaths(state.dir)
  const total = state.seeded?.count ?? 0
  return {
    take: async (purpose) => {
      const names = store
        .list(paths.ready)
        .filter((name) => name.endsWith(".json"))
        .sort()
      for (const name of names) {
        const taken = join(paths.taken, name)
        if (!store.rename(join(paths.ready, name), taken)) continue
        const account = JSON.parse(store.read(taken))
        markUsed(store, paths, account, purpose)
        return {
          email: account.email,
          cookies: cookiesFromSetCookie(account.setCookie, "localhost"),
        }
      }
      throw new Error(
        total
          ? `${purpose}: all ${total} seeded accounts of this app are used; run node scripts/ui.mjs down, then up, for a fresh set, or pass --accounts pooled`
          : `${purpose}: this app was started without seeded accounts; run node scripts/ui.mjs down, then up, or pass --accounts pooled`
      )
    },
  }
}

export function accountSource(kind, state, options) {
  if (kind === "pooled") return pooled(state, options)
  if (kind === "seeded") return seeded(state, options)
  throw new Error(
    `--accounts takes ${ACCOUNT_SOURCES.join(" or ")}, got ${kind}`
  )
}
