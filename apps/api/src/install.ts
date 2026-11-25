import { implementations } from "./generated/catalog.js"
import { bindCatalog } from "./registry/bind.js"
import { registerCoachTasks } from "./coach/index.js"
import { registerChat } from "./coach/chat/index.js"
import { registerJob, type JobPreviewOptions } from "./job/index.js"
import { registerPaper } from "./paper/index.js"
import { registry } from "./registry/registry.js"

let installed = false

export function installRegistry(preview?: JobPreviewOptions) {
  if (!installed) {
    registerChat(registry)
    registerCoachTasks()
    registerPaper(registry)
    registerJob(registry, preview)
    bindCatalog(registry, implementations)
    installed = true
    return registry
  }
  registerJob(registry, preview)
  return registry
}
