import { implementations } from "./generated/catalog.js"
import { bindCatalog } from "./bind.js"
import { registerCoachTasks } from "./commands.js"
import { registerConnections } from "../connections/index.js"
import { registerAccount, registerAccountQueries } from "../account/index.js"
import { registerChat } from "../chat/index.js"
import { registerInbox } from "../inbox/index.js"
import { registerJob, type JobPreviewOptions } from "../job/index.js"
import { registerPaper } from "../paper/index.js"
import { registry } from "./registry.js"

let installed = false

export function installRegistry(preview?: JobPreviewOptions) {
  if (!installed) {
    registerConnections(registry)
    registerAccount(registry)
    registerAccountQueries(registry)
    registerChat(registry)
    registerCoachTasks(registry)
    registerPaper(registry)
    registerJob(registry, preview)
    registerInbox(registry)
    bindCatalog(registry, implementations)
    installed = true
    return registry
  }
  registerJob(registry, preview)
  return registry
}
