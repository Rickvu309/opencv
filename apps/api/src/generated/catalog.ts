import type { Implementations } from "@workspace/domain"
import { catalog } from "@workspace/domain"
import { implementation as job$priorityCounts } from "../job/operations/priority-counts/server.js"
import { implementation as job$setPriority } from "../job/operations/set-priority/server.js"
import { implementation as paper$export } from "../paper/operations/export/server.js"
import { implementation as paper$import } from "../paper/operations/import/server.js"
import { implementation as paper$nativeWord } from "../paper/operations/native-word/server.js"
import { implementation as paper$read } from "../paper/operations/read/server.js"

export const implementations = {
  "job.priorityCounts": job$priorityCounts,
  "job.setPriority": job$setPriority,
  "paper.export": paper$export,
  "paper.import": paper$import,
  "paper.nativeWord": paper$nativeWord,
  "paper.read": paper$read,
} satisfies Implementations<typeof catalog>
