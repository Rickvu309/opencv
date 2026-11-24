import { operation as actions$approve } from "../operations/actions/approve/operation.js"
import { operation as actions$deny } from "../operations/actions/deny/operation.js"
import { operation as activity$undo } from "../operations/activity/undo/operation.js"
import { operation as connections$list } from "../operations/connections/list/operation.js"
import { operation as connections$revoke } from "../operations/connections/revoke/operation.js"
import { operation as job$priorityCounts } from "../operations/job/priority-counts/operation.js"
import { operation as job$setPriority } from "../operations/job/set-priority/operation.js"
import { operation as paper$export } from "../operations/paper/export/operation.js"
import { operation as paper$import } from "../operations/paper/import/operation.js"
import { operation as paper$nativeWord } from "../operations/paper/native-word/operation.js"
import { operation as paper$read } from "../operations/paper/read/operation.js"

export const catalog = {
  "actions.approve": actions$approve,
  "actions.deny": actions$deny,
  "activity.undo": activity$undo,
  "connections.list": connections$list,
  "connections.revoke": connections$revoke,
  "job.priorityCounts": job$priorityCounts,
  "job.setPriority": job$setPriority,
  "paper.export": paper$export,
  "paper.import": paper$import,
  "paper.nativeWord": paper$nativeWord,
  "paper.read": paper$read,
} as const
