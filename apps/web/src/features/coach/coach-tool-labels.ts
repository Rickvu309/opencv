import {
  catalog,
  chatToolNameSchema,
  type ChatToolName,
} from "@workspace/domain"

type ToolCopy = { label: string; read?: string }

const TOOL_COPY = {
  [catalog["account.delete"].name]: { label: "Delete your account" },
  [catalog["account.requestEmailChange"].name]: { label: "Change your email" },
  [catalog["actions.approve"].name]: { label: "Approve this change" },
  [catalog["actions.deny"].name]: { label: "Deny this change" },
  [catalog["activity.list"].name]: {
    label: "Look at your activity",
    read: "Looked at your activity",
  },
  [catalog["activity.undo"].name]: { label: "Undo this change" },
  [catalog["billing.get"].name]: {
    label: "Look at your plan",
    read: "Looked at your plan",
  },
  [catalog["chat.appendMessage"].name]: { label: "Save this message" },
  [catalog["chat.create"].name]: { label: "Start a Chat" },
  [catalog["chat.delete"].name]: { label: "Delete this Chat" },
  [catalog["chat.get"].name]: {
    label: "Read this Chat",
    read: "Read this Chat",
  },
  [catalog["chat.list"].name]: {
    label: "Look at your Chats",
    read: "Looked at your Chats",
  },
  [catalog["chat.open"].name]: { label: "Open this Chat" },
  [catalog["chat.rename"].name]: { label: "Rename this Chat" },
  [catalog["chat.setFocus"].name]: { label: "Focus this Chat" },
  [catalog["coach.events"].name]: {
    label: "Read Coach updates",
    read: "Read Coach updates",
  },
  [catalog["coach.start"].name]: { label: "Start Coach" },
  [catalog["coach.status"].name]: {
    label: "Check Coach progress",
    read: "Checked Coach progress",
  },
  [catalog["coach.stop"].name]: { label: "Stop Coach" },
  [catalog["coach.usage"].name]: {
    label: "Check Coach usage",
    read: "Checked Coach usage",
  },
  [catalog["connections.list"].name]: {
    label: "Look at your connections",
    read: "Looked at your connections",
  },
  [catalog["connections.revoke"].name]: { label: "Disconnect your account" },
  "file.get": { label: "Read your file", read: "Read your file" },
  [catalog["inbox.acceptSuggestion"].name]: { label: "Accept this suggestion" },
  [catalog["inbox.addToCalendar"].name]: {
    label: "Add this event to your calendar",
  },
  [catalog["inbox.clearSuggestion"].name]: { label: "Clear this suggestion" },
  [catalog["inbox.draftReply"].name]: { label: "Draft a reply" },
  [catalog["inbox.get"].name]: {
    label: "Read this message",
    read: "Read this message",
  },
  [catalog["inbox.list"].name]: {
    label: "Look at your Inbox",
    read: "Looked at your Inbox",
  },
  [catalog["inbox.markDone"].name]: { label: "Mark this message done" },
  [catalog["inbox.scan"].name]: { label: "Check your Inbox" },
  [catalog["inbox.send"].name]: { label: "Send your reply" },
  [catalog["inbox.skip"].name]: { label: "Skip this message" },
  [catalog["inbox.snooze"].name]: { label: "Snooze this message" },
  [catalog["inbox.snoozed"].name]: {
    label: "Look at snoozed messages",
    read: "Looked at snoozed messages",
  },
  [catalog["inbox.updateDraft"].name]: { label: "Update your draft" },
  [catalog["integrations.list"].name]: {
    label: "Look at your integrations",
    read: "Looked at your integrations",
  },
  [catalog["job.addChecklistItem"].name]: {
    label: "Add a Job checklist item",
  },
  [catalog["job.checklistItem"].name]: {
    label: "Read a Job checklist item",
    read: "Read a Job checklist item",
  },
  [catalog["job.addNote"].name]: { label: "Add a Job note" },
  [catalog["job.calendar"].name]: {
    label: "Look at your Job events",
    read: "Looked at your Job events",
  },
  [catalog["job.create"].name]: { label: "Add a Job" },
  [catalog["job.delete"].name]: { label: "Delete this Job" },
  [catalog["job.get"].name]: { label: "Read this Job", read: "Read this Job" },
  [catalog["job.linkPaper"].name]: { label: "Link Paper to this Job" },
  [catalog["job.list"].name]: {
    label: "Look at your Jobs",
    read: "Looked at your Jobs",
  },
  [catalog["job.move"].name]: { label: "Move this Job" },
  [catalog["job.preview"].name]: {
    label: "Preview this Job",
    read: "Previewed this Job",
  },
  [catalog["job.removeChecklistItem"].name]: {
    label: "Remove a Job checklist item",
  },
  [catalog["job.setChecklistItem"].name]: {
    label: "Update a Job checklist item",
  },
  [catalog["job.star"].name]: { label: "Update this Job's star" },
  [catalog["job.unlinkPaper"].name]: { label: "Unlink Paper from this Job" },
  [catalog["job.update"].name]: { label: "Update this Job" },
  [catalog["job.priorityCounts"].name]: {
    label: "Look at your Job priorities",
    read: "Looked at your Job priorities",
  },
  [catalog["job.setPriority"].name]: { label: "Update this Job's priority" },
  "link.get": { label: "Read this link", read: "Read this link" },
  [catalog["notify.request"].name]: { label: "Set a reminder" },
  "paper.canvas": { label: "Update your Paper layout" },
  "paper.create": { label: "Create a Paper" },
  "paper.delete": { label: "Delete this Paper" },
  "paper.deleteFile": { label: "Remove this file" },
  "paper.duplicate": { label: "Duplicate this Paper" },
  "paper.document": { label: "Open your Paper", read: "Opened your Paper" },
  "paper.edit": { label: "Edit your Paper" },
  [catalog["paper.export"].name]: { label: "Export your Paper" },
  [catalog["paper.import"].name]: { label: "Import your Paper" },
  "paper.files": {
    label: "Look at your Paper files",
    read: "Looked at your Paper files",
  },
  "paper.get": { label: "Read your Paper", read: "Read your Paper" },
  "paper.list": { label: "Look at your Paper", read: "Looked at your Paper" },
  "paper.outline": {
    label: "Read your Paper outline",
    read: "Read your Paper outline",
  },
  "paper.isDeleted": {
    label: "Check a deleted Paper",
    read: "Checked a deleted Paper",
  },
  [catalog["paper.read"].name]: {
    label: "Read your Paper",
    read: "Read your Paper",
  },
  "paper.rename": { label: "Rename your Paper" },
  "paper.restoreDeleted": { label: "Bring back your Paper" },
  "paper.setFavorite": { label: "Update your Paper's favorite" },
  "paper.setStatus": { label: "Update your Paper's status" },
  "paper.start": { label: "Start a CV or Letter in Paper" },
  "paper.nativeSync": { label: "Save your Paper" },
  [catalog["paper.nativeWord"].name]: { label: "Download your Paper as Word" },
  [catalog["profile.get"].name]: {
    label: "Read your Profile",
    read: "Read your Profile",
  },
  [catalog["profile.markWelcomed"].name]: { label: "Finish your welcome" },
  [catalog["profile.setPhoto"].name]: { label: "Update your Profile photo" },
  [catalog["profile.update"].name]: { label: "Update your Profile" },
  [catalog["workspace.search"].name]: {
    label: "Search your workspace",
    read: "Searched your workspace",
  },
} satisfies Record<ChatToolName, ToolCopy>

const toolCopy: Record<ChatToolName, ToolCopy> = TOOL_COPY

export const COACH_TOOL_LABELS = Object.fromEntries(
  chatToolNameSchema.options.map((name) => [name, toolCopy[name].label])
) as Record<ChatToolName, string>

export function coachToolLabel(name: string) {
  const parsed = chatToolNameSchema.safeParse(name)
  return parsed.success ? toolCopy[parsed.data].label : "Coach action"
}

export function coachReadLabel(name: string) {
  const parsed = chatToolNameSchema.safeParse(name)
  return parsed.success ? toolCopy[parsed.data].read : undefined
}

export function humanToolText(text: string) {
  return text.replace(/\b[a-z]+\.[a-zA-Z.]+\b/g, (name) => {
    const parsed = chatToolNameSchema.safeParse(name)
    return parsed.success ? toolCopy[parsed.data].label : name
  })
}
