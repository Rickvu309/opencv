import type { Implementations } from "@workspace/domain"
import { catalog } from "@workspace/domain"
import { implementation as implementation0 } from "../../job/operations/priority-counts/server.js"
import { implementation as implementation1 } from "../../job/operations/set-priority/server.js"

export const implementations = {
  "job.priorityCounts": implementation0,
  "job.setPriority": implementation1,
} satisfies Implementations<typeof catalog>
