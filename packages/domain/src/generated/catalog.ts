import { operation as account$delete } from "../operations/account/delete/operation.js"
import { operation as account$requestEmailChange } from "../operations/account/request-email-change/operation.js"
import { operation as actions$approve } from "../operations/actions/approve/operation.js"
import { operation as actions$deny } from "../operations/actions/deny/operation.js"
import { operation as activity$list } from "../operations/activity/list/operation.js"
import { operation as activity$undo } from "../operations/activity/undo/operation.js"
import { operation as billing$get } from "../operations/billing/get/operation.js"
import { operation as chat$appendMessage } from "../operations/chat/append-message/operation.js"
import { operation as chat$create } from "../operations/chat/create/operation.js"
import { operation as chat$delete } from "../operations/chat/delete/operation.js"
import { operation as chat$get } from "../operations/chat/get/operation.js"
import { operation as chat$list } from "../operations/chat/list/operation.js"
import { operation as chat$open } from "../operations/chat/open/operation.js"
import { operation as chat$rename } from "../operations/chat/rename/operation.js"
import { operation as chat$setFocus } from "../operations/chat/set-focus/operation.js"
import { operation as coach$events } from "../operations/coach/events/operation.js"
import { operation as coach$start } from "../operations/coach/start/operation.js"
import { operation as coach$status } from "../operations/coach/status/operation.js"
import { operation as coach$stop } from "../operations/coach/stop/operation.js"
import { operation as coach$usage } from "../operations/coach/usage/operation.js"
import { operation as connections$list } from "../operations/connections/list/operation.js"
import { operation as connections$revoke } from "../operations/connections/revoke/operation.js"
import { operation as file$get } from "../operations/file/get/operation.js"
import { operation as inbox$acceptSuggestion } from "../operations/inbox/accept-suggestion/operation.js"
import { operation as inbox$addToCalendar } from "../operations/inbox/add-to-calendar/operation.js"
import { operation as inbox$clearSuggestion } from "../operations/inbox/clear-suggestion/operation.js"
import { operation as inbox$draftReply } from "../operations/inbox/draft-reply/operation.js"
import { operation as inbox$get } from "../operations/inbox/get/operation.js"
import { operation as inbox$list } from "../operations/inbox/list/operation.js"
import { operation as inbox$markDone } from "../operations/inbox/mark-done/operation.js"
import { operation as inbox$scan } from "../operations/inbox/scan/operation.js"
import { operation as inbox$send } from "../operations/inbox/send/operation.js"
import { operation as inbox$skip } from "../operations/inbox/skip/operation.js"
import { operation as inbox$snooze } from "../operations/inbox/snooze/operation.js"
import { operation as inbox$snoozed } from "../operations/inbox/snoozed/operation.js"
import { operation as inbox$updateDraft } from "../operations/inbox/update-draft/operation.js"
import { operation as integrations$list } from "../operations/integrations/list/operation.js"
import { operation as job$addChecklistItem } from "../operations/job/add-checklist-item/operation.js"
import { operation as job$addNote } from "../operations/job/add-note/operation.js"
import { operation as job$calendar } from "../operations/job/calendar/operation.js"
import { operation as job$checklistItem } from "../operations/job/checklist-item/operation.js"
import { operation as job$create } from "../operations/job/create/operation.js"
import { operation as job$delete } from "../operations/job/delete/operation.js"
import { operation as job$get } from "../operations/job/get/operation.js"
import { operation as job$linkPaper } from "../operations/job/link-paper/operation.js"
import { operation as job$list } from "../operations/job/list/operation.js"
import { operation as job$move } from "../operations/job/move/operation.js"
import { operation as job$preview } from "../operations/job/preview/operation.js"
import { operation as job$priorityCounts } from "../operations/job/priority-counts/operation.js"
import { operation as job$removeChecklistItem } from "../operations/job/remove-checklist-item/operation.js"
import { operation as job$setChecklistItem } from "../operations/job/set-checklist-item/operation.js"
import { operation as job$setPriority } from "../operations/job/set-priority/operation.js"
import { operation as job$star } from "../operations/job/star/operation.js"
import { operation as job$unlinkPaper } from "../operations/job/unlink-paper/operation.js"
import { operation as job$update } from "../operations/job/update/operation.js"
import { operation as link$get } from "../operations/link/get/operation.js"
import { operation as notify$request } from "../operations/notify/request/operation.js"
import { operation as paper$changes } from "../operations/paper/changes/operation.js"
import { operation as paper$create } from "../operations/paper/create/operation.js"
import { operation as paper$delete } from "../operations/paper/delete/operation.js"
import { operation as paper$deleteFile } from "../operations/paper/delete-file/operation.js"
import { operation as paper$duplicate } from "../operations/paper/duplicate/operation.js"
import { operation as paper$edit } from "../operations/paper/edit/operation.js"
import { operation as paper$export } from "../operations/paper/export/operation.js"
import { operation as paper$files } from "../operations/paper/files/operation.js"
import { operation as paper$firstPages } from "../operations/paper/first-pages/operation.js"
import { operation as paper$head } from "../operations/paper/head/operation.js"
import { operation as paper$import } from "../operations/paper/import/operation.js"
import { operation as paper$list } from "../operations/paper/list/operation.js"
import { operation as paper$outline } from "../operations/paper/outline/operation.js"
import { operation as paper$read } from "../operations/paper/read/operation.js"
import { operation as paper$save } from "../operations/paper/save/operation.js"
import { operation as paper$start } from "../operations/paper/start/operation.js"
import { operation as paper$update } from "../operations/paper/update/operation.js"
import { operation as profile$get } from "../operations/profile/get/operation.js"
import { operation as profile$markWelcomed } from "../operations/profile/mark-welcomed/operation.js"
import { operation as profile$setPhoto } from "../operations/profile/set-photo/operation.js"
import { operation as profile$update } from "../operations/profile/update/operation.js"
import { operation as workspace$search } from "../operations/workspace/search/operation.js"

export const catalog = {
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
  "paper.changes": paper$changes,
  "paper.create": paper$create,
  "paper.delete": paper$delete,
  "paper.deleteFile": paper$deleteFile,
  "paper.duplicate": paper$duplicate,
  "paper.edit": paper$edit,
  "paper.export": paper$export,
  "paper.files": paper$files,
  "paper.firstPages": paper$firstPages,
  "paper.head": paper$head,
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
} as const
