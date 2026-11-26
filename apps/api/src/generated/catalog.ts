import type { Implementations } from "@workspace/domain/kernel"
import { catalog } from "@workspace/domain/kernel"
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
import { implementation as chat$get } from "../coach/operations/chat/get/server.js"
import { implementation as chat$list } from "../coach/operations/chat/list/server.js"
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
import { implementation as file$get } from "../paper/operations/file/get/server.js"
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
import { implementation as job$addChecklistItem } from "../job/operations/add-checklist-item/server.js"
import { implementation as job$addNote } from "../job/operations/add-note/server.js"
import { implementation as job$calendar } from "../job/operations/calendar/server.js"
import { implementation as job$checklistItem } from "../job/operations/checklist-item/server.js"
import { implementation as job$create } from "../job/operations/create/server.js"
import { implementation as job$delete } from "../job/operations/delete/server.js"
import { implementation as job$get } from "../job/operations/get/server.js"
import { implementation as job$linkPaper } from "../job/operations/link-paper/server.js"
import { implementation as job$list } from "../job/operations/list/server.js"
import { implementation as job$move } from "../job/operations/move/server.js"
import { implementation as job$preview } from "../job/operations/preview/server.js"
import { implementation as job$priorityCounts } from "../job/operations/priority-counts/server.js"
import { implementation as job$removeChecklistItem } from "../job/operations/remove-checklist-item/server.js"
import { implementation as job$setChecklistItem } from "../job/operations/set-checklist-item/server.js"
import { implementation as job$setPriority } from "../job/operations/set-priority/server.js"
import { implementation as job$star } from "../job/operations/star/server.js"
import { implementation as job$unlinkPaper } from "../job/operations/unlink-paper/server.js"
import { implementation as job$update } from "../job/operations/update/server.js"
import { implementation as link$get } from "../coach/operations/link/get/server.js"
import { implementation as notify$request } from "../account/operations/notify/request/server.js"
import { implementation as paper$create } from "../paper/operations/create/server.js"
import { implementation as paper$delete } from "../paper/operations/delete/server.js"
import { implementation as paper$deleteFile } from "../paper/operations/delete-file/server.js"
import { implementation as paper$duplicate } from "../paper/operations/duplicate/server.js"
import { implementation as paper$edit } from "../paper/operations/edit/server.js"
import { implementation as paper$export } from "../paper/operations/export/server.js"
import { implementation as paper$files } from "../paper/operations/files/server.js"
import { implementation as paper$import } from "../paper/operations/import/server.js"
import { implementation as paper$list } from "../paper/operations/list/server.js"
import { implementation as paper$outline } from "../paper/operations/outline/server.js"
import { implementation as paper$read } from "../paper/operations/read/server.js"
import { implementation as paper$save } from "../paper/operations/save/server.js"
import { implementation as paper$start } from "../paper/operations/start/server.js"
import { implementation as paper$update } from "../paper/operations/update/server.js"
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
  "chat.get": chat$get,
  "chat.list": chat$list,
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
  "file.get": file$get,
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
  "job.addChecklistItem": job$addChecklistItem,
  "job.addNote": job$addNote,
  "job.calendar": job$calendar,
  "job.checklistItem": job$checklistItem,
  "job.create": job$create,
  "job.delete": job$delete,
  "job.get": job$get,
  "job.linkPaper": job$linkPaper,
  "job.list": job$list,
  "job.move": job$move,
  "job.preview": job$preview,
  "job.priorityCounts": job$priorityCounts,
  "job.removeChecklistItem": job$removeChecklistItem,
  "job.setChecklistItem": job$setChecklistItem,
  "job.setPriority": job$setPriority,
  "job.star": job$star,
  "job.unlinkPaper": job$unlinkPaper,
  "job.update": job$update,
  "link.get": link$get,
  "notify.request": notify$request,
  "paper.create": paper$create,
  "paper.delete": paper$delete,
  "paper.deleteFile": paper$deleteFile,
  "paper.duplicate": paper$duplicate,
  "paper.edit": paper$edit,
  "paper.export": paper$export,
  "paper.files": paper$files,
  "paper.import": paper$import,
  "paper.list": paper$list,
  "paper.outline": paper$outline,
  "paper.read": paper$read,
  "paper.save": paper$save,
  "paper.start": paper$start,
  "paper.update": paper$update,
  "profile.get": profile$get,
  "profile.markWelcomed": profile$markWelcomed,
  "profile.setPhoto": profile$setPhoto,
  "profile.update": profile$update,
  "workspace.search": workspace$search,
} satisfies Implementations<typeof catalog>
