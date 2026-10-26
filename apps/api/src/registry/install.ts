import { registerAccount, registerAccountQueries } from "../account/index.js"
import { registerChat } from "../chat/index.js"
import { registerJob, type JobPreviewOptions } from "../job/index.js"
import { registerPaper } from "../paper/index.js"
import { registry } from "./registry.js"

let installed = false

export function installRegistry(preview?: JobPreviewOptions) {
  if (!installed) {
    registerAccount(registry)
    registerAccountQueries(registry)
    registerChat(registry)
    registerPaper(registry)
    registerJob(registry, preview)
    installed = true
    return registry
  }
  registerJob(registry, preview)
  return registry
}

export function registryInstalled() {
  return installed
}
