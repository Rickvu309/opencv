import type { Implementations } from "@workspace/domain"
import { catalog } from "@workspace/domain"
import { implementation as implementation0 } from "../../job/operations/priority-counts/server.js"
import { implementation as implementation1 } from "../../job/operations/set-priority/server.js"
import { implementation as implementation2 } from "../../paper/operations/export/server.js"
import { implementation as implementation3 } from "../../paper/operations/import/server.js"
import { implementation as implementation4 } from "../../paper/operations/read/server.js"

export const implementations = {
  "job.priorityCounts": implementation0,
  "job.setPriority": implementation1,
  "paper.export": implementation2,
  "paper.import": implementation3,
  "paper.read": implementation4,
} satisfies Implementations<typeof catalog>
