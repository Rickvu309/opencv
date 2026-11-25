import type { Implementations } from "@workspace/domain"
import { catalog } from "@workspace/domain"
import { implementation as account$delete } from "../account/operations/account/delete/server.js"
import { implementation as account$requestEmailChange } from "../account/operations/account/request-email-change/server.js"
import { implementation as actions$approve } from "../registry/operations/actions/approve/server.js"
import { implementation as actions$deny } from "../registry/operations/actions/deny/server.js"
import { implementation as activity$list } from "../account/operations/activity/list/server.js"
import { implementation as activity$undo } from "../registry/operations/activity/undo/server.js"
import { implementation as billing$get } from "../account/operations/billing/get/server.js"
import { implementation as chat$appendMessage } from "../coach/operations/chat/append-message/server.js"
import { implementation as chat$create } from "../coach/operations/chat/create/server.js"
import { implementation as chat$delete } from "../coach/operations/chat/delete/server.js"
import { implementation as chat$open } from "../coach/operations/chat/open/server.js"
import { implementation as chat$rename } from "../coach/operations/chat/rename/server.js"
import { implementation as chat$setFocus } from "../coach/operations/chat/set-focus/server.js"
import { implementation as coach$events } from "../coach/operations/events/server.js"
import { implementation as coach$start } from "../coach/operations/start/server.js"
import { implementation as coach$status } from "../coach/operations/status/server.js"
import { implementation as coach$stop } from "../coach/operations/stop/server.js"
import { implementation as coach$usage } from "../account/operations/coach/usage/server.js"
import { implementation as connections$list } from "../connections/operations/list/server.js"
import { implementation as connections$revoke } from "../connections/operations/revoke/server.js"
import { implementation as inbox$acceptSuggestion } from "../inbox/operations/accept-suggestion/server.js"
import { implementation as inbox$addToCalendar } from "../inbox/operations/add-to-calendar/server.js"
import { implementation as inbox$clearSuggestion } from "../inbox/operations/clear-suggestion/server.js"
import { implementation as inbox$draftReply } from "../inbox/operations/draft-reply/server.js"
import { implementation as inbox$get } from "../inbox/operations/get/server.js"
import { implementation as inbox$list } from "../inbox/operations/list/server.js"
import { implementation as inbox$markDone } from "../inbox/operations/mark-done/server.js"
import { implementation as inbox$scan } from "../inbox/operations/scan/server.js"
import { implementation as inbox$send } from "../inbox/operations/send/server.js"
import { implementation as inbox$skip } from "../inbox/operations/skip/server.js"
import { implementation as inbox$snooze } from "../inbox/operations/snooze/server.js"
import { implementation as inbox$snoozed } from "../inbox/operations/snoozed/server.js"
import { implementation as inbox$updateDraft } from "../inbox/operations/update-draft/server.js"
import { implementation as integrations$list } from "../account/operations/integrations/list/server.js"
import { implementation as job$addNote } from "../job/operations/add-note/server.js"
import { implementation as job$calendar } from "../job/operations/calendar/server.js"
import { implementation as job$delete } from "../job/operations/delete/server.js"
import { implementation as job$get } from "../job/operations/get/server.js"
import { implementation as job$list } from "../job/operations/list/server.js"
import { implementation as job$preview } from "../job/operations/preview/server.js"
import { implementation as job$priorityCounts } from "../job/operations/priority-counts/server.js"
import { implementation as job$removeChecklistItem } from "../job/operations/remove-checklist-item/server.js"
import { implementation as job$setPriority } from "../job/operations/set-priority/server.js"
import { implementation as job$star } from "../job/operations/star/server.js"
import { implementation as job$unlinkPaper } from "../job/operations/unlink-paper/server.js"
import { implementation as notify$request } from "../account/operations/notify/request/server.js"
import { implementation as paper$export } from "../paper/operations/export/server.js"
import { implementation as paper$import } from "../paper/operations/import/server.js"
import { implementation as paper$nativeWord } from "../paper/operations/native-word/server.js"
import { implementation as paper$read } from "../paper/operations/read/server.js"
import { implementation as profile$get } from "../account/operations/profile/get/server.js"
import { implementation as profile$markWelcomed } from "../account/operations/profile/mark-welcomed/server.js"
import { implementation as profile$setPhoto } from "../account/operations/profile/set-photo/server.js"
import { implementation as profile$update } from "../account/operations/profile/update/server.js"
import { implementation as workspace$search } from "../account/operations/workspace/search/server.js"

export const implementations = {
  "account.delete": account$delete,
  "account.requestEmailChange": account$requestEmailChange,
  "actions.approve": actions$approve,
  "actions.deny": actions$deny,
  "activity.list": activity$list,
  "activity.undo": activity$undo,
  "billing.get": billing$get,
  "chat.appendMessage": chat$appendMessage,
  "chat.create": chat$create,
  "chat.delete": chat$delete,
  "chat.open": chat$open,
  "chat.rename": chat$rename,
  "chat.setFocus": chat$setFocus,
  "coach.events": coach$events,
  "coach.start": coach$start,
  "coach.status": coach$status,
  "coach.stop": coach$stop,
  "coach.usage": coach$usage,
  "connections.list": connections$list,
  "connections.revoke": connections$revoke,
  "inbox.acceptSuggestion": inbox$acceptSuggestion,
  "inbox.addToCalendar": inbox$addToCalendar,
  "inbox.clearSuggestion": inbox$clearSuggestion,
  "inbox.draftReply": inbox$draftReply,
  "inbox.get": inbox$get,
  "inbox.list": inbox$list,
  "inbox.markDone": inbox$markDone,
  "inbox.scan": inbox$scan,
  "inbox.send": inbox$send,
  "inbox.skip": inbox$skip,
  "inbox.snooze": inbox$snooze,
  "inbox.snoozed": inbox$snoozed,
  "inbox.updateDraft": inbox$updateDraft,
  "integrations.list": integrations$list,
  "job.addNote": job$addNote,
  "job.calendar": job$calendar,
  "job.delete": job$delete,
  "job.get": job$get,
  "job.list": job$list,
  "job.preview": job$preview,
  "job.priorityCounts": job$priorityCounts,
  "job.removeChecklistItem": job$removeChecklistItem,
  "job.setPriority": job$setPriority,
  "job.star": job$star,
  "job.unlinkPaper": job$unlinkPaper,
  "notify.request": notify$request,
  "paper.export": paper$export,
  "paper.import": paper$import,
  "paper.nativeWord": paper$nativeWord,
  "paper.read": paper$read,
  "profile.get": profile$get,
  "profile.markWelcomed": profile$markWelcomed,
  "profile.setPhoto": profile$setPhoto,
  "profile.update": profile$update,
  "workspace.search": workspace$search,
} satisfies Implementations<typeof catalog>
