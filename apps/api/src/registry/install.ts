import { registerAccount, registerAccountQueries } from "../account/index.js"
import { registerChat } from "../chat/index.js"
import { registerJob } from "../job/index.js"
import { registerPaper } from "../paper/index.js"
import { registry } from "./registry.js"

let installed = false

export function installRegistry() {
  if (installed) return registry
  registerAccount(registry)
  registerAccountQueries(registry)
  registerChat(registry)
  registerPaper(registry)
  registerJob(registry)
  installed = true
  return registry
}

export function registryInstalled() {
  return installed
}
