import type { Implementations } from "@workspace/domain"
import { catalog } from "@workspace/domain"
import { implementation as actions$approve } from "../registry/operations/actions/approve/server.js"
import { implementation as actions$deny } from "../registry/operations/actions/deny/server.js"
import { implementation as activity$undo } from "../registry/operations/activity/undo/server.js"
import { implementation as coach$events } from "../coach/operations/events/server.js"
import { implementation as coach$start } from "../coach/operations/start/server.js"
import { implementation as coach$status } from "../coach/operations/status/server.js"
import { implementation as coach$stop } from "../coach/operations/stop/server.js"
import { implementation as connections$list } from "../connections/operations/list/server.js"
import { implementation as connections$revoke } from "../connections/operations/revoke/server.js"
import { implementation as job$priorityCounts } from "../job/operations/priority-counts/server.js"
import { implementation as job$setPriority } from "../job/operations/set-priority/server.js"
import { implementation as paper$export } from "../paper/operations/export/server.js"
import { implementation as paper$import } from "../paper/operations/import/server.js"
import { implementation as paper$nativeWord } from "../paper/operations/native-word/server.js"
import { implementation as paper$read } from "../paper/operations/read/server.js"

export const implementations = {
  "actions.approve": actions$approve,
  "actions.deny": actions$deny,
  "activity.undo": activity$undo,
  "coach.events": coach$events,
  "coach.start": coach$start,
  "coach.status": coach$status,
  "coach.stop": coach$stop,
  "connections.list": connections$list,
  "connections.revoke": connections$revoke,
  "job.priorityCounts": job$priorityCounts,
  "job.setPriority": job$setPriority,
  "paper.export": paper$export,
  "paper.import": paper$import,
  "paper.nativeWord": paper$nativeWord,
  "paper.read": paper$read,
} satisfies Implementations<typeof catalog>
