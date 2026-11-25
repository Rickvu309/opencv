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
  "activity.list": {
    label: "Look at your activity",
    read: "Looked at your activity",
  },
  [catalog["activity.undo"].name]: { label: "Undo this change" },
  "billing.get": { label: "Look at your plan", read: "Looked at your plan" },
  [catalog["chat.appendMessage"].name]: { label: "Save this message" },
  [catalog["chat.create"].name]: { label: "Start a Chat" },
  [catalog["chat.delete"].name]: { label: "Delete this Chat" },
  "chat.get": { label: "Read this Chat", read: "Read this Chat" },
  "chat.list": { label: "Look at your Chats", read: "Looked at your Chats" },
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
  "coach.usage": { label: "Check Coach usage", read: "Checked Coach usage" },
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
  "inbox.get": { label: "Read this message", read: "Read this message" },
  "inbox.list": { label: "Look at your Inbox", read: "Looked at your Inbox" },
  [catalog["inbox.markDone"].name]: { label: "Mark this message done" },
  [catalog["inbox.scan"].name]: { label: "Check your Inbox" },
  [catalog["inbox.send"].name]: { label: "Send your reply" },
  [catalog["inbox.skip"].name]: { label: "Skip this message" },
  [catalog["inbox.snooze"].name]: { label: "Snooze this message" },
  "inbox.snoozed": {
    label: "Look at snoozed messages",
    read: "Looked at snoozed messages",
  },
  [catalog["inbox.updateDraft"].name]: { label: "Update your draft" },
  "integrations.list": {
    label: "Look at your integrations",
    read: "Looked at your integrations",
  },
  "job.addChecklistItem": { label: "Add a Job checklist item" },
  "job.addNote": { label: "Add a Job note" },
  "job.calendar": {
    label: "Look at your Job events",
    read: "Looked at your Job events",
  },
  "job.create": { label: "Add a Job" },
  "job.delete": { label: "Delete this Job" },
  "job.get": { label: "Read this Job", read: "Read this Job" },
  "job.linkPaper": { label: "Link Paper to this Job" },
  "job.list": { label: "Look at your Jobs", read: "Looked at your Jobs" },
  "job.move": { label: "Move this Job" },
  "job.preview": { label: "Preview this Job", read: "Previewed this Job" },
  "job.removeChecklistItem": { label: "Remove a Job checklist item" },
  "job.setChecklistItem": { label: "Update a Job checklist item" },
  "job.star": { label: "Update this Job's star" },
  "job.unlinkPaper": { label: "Unlink Paper from this Job" },
  "job.update": { label: "Update this Job" },
  [catalog["job.priorityCounts"].name]: {
    label: "Look at your Job priorities",
    read: "Looked at your Job priorities",
  },
  [catalog["job.setPriority"].name]: { label: "Update this Job's priority" },
  "link.get": { label: "Read this link", read: "Read this link" },
  [catalog["notify.request"].name]: { label: "Set a reminder" },
  "paper.attachPhoto": { label: "Add a photo to your Paper" },
  "paper.canvas": { label: "Update your Paper layout" },
  "paper.create": { label: "Create a Paper" },
  "paper.delete": { label: "Delete this Paper" },
  "paper.deleteFile": { label: "Remove this file" },
  "paper.dismissCheck": { label: "Dismiss this Paper check" },
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
  "paper.keepTwoPages": { label: "Fit your Paper to two pages" },
  "paper.keywordGap": {
    label: "Check your Paper's keywords",
    read: "Checked your Paper's keywords",
  },
  "paper.list": { label: "Look at your Paper", read: "Looked at your Paper" },
  "paper.outline": {
    label: "Read your Paper outline",
    read: "Read your Paper outline",
  },
  "paper.isDeleted": {
    label: "Check a deleted Paper",
    read: "Checked a deleted Paper",
  },
  "paper.pageCount": {
    label: "Check your Paper's page count",
    read: "Checked your Paper's page count",
  },
  [catalog["paper.read"].name]: {
    label: "Read your Paper",
    read: "Read your Paper",
  },
  "paper.rename": { label: "Rename your Paper" },
  "paper.restoreDeleted": { label: "Bring back your Paper" },
  "paper.revertEdit": { label: "Restore your Paper" },
  "paper.setFavorite": { label: "Update your Paper's favorite" },
  "paper.setStatus": { label: "Update your Paper's status" },
  "paper.setTemplate": { label: "Change your Paper template" },
  "paper.share": { label: "Share your Paper" },
  "paper.shared": {
    label: "Read the shared Paper",
    read: "Read the shared Paper",
  },
  "paper.start": { label: "Start a CV or Letter in Paper" },
  "paper.nativeSync": { label: "Save your Paper" },
  [catalog["paper.nativeWord"].name]: { label: "Download your Paper as Word" },
  "paper.sync": { label: "Save your Paper" },
  "paper.unshare": { label: "Stop sharing your Paper" },
  "profile.get": { label: "Read your Profile", read: "Read your Profile" },
  [catalog["profile.markWelcomed"].name]: { label: "Finish your welcome" },
  [catalog["profile.setPhoto"].name]: { label: "Update your Profile photo" },
  [catalog["profile.update"].name]: { label: "Update your Profile" },
  "workspace.search": {
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
