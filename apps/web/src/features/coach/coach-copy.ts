export const coachCopy = {
  newChat: "New chat",
  howCanIHelp: "How can I help?",
  moreIdeas: "More ideas",
  searchChats: "Search chats",
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  noChats: "No chats yet",
  chatHistory: "Chat history",
  messageCoach: "Message Coach",
  addContext: "Add context",
  send: "Send",
  stop: "Stop",
  upload: "Upload a file",
  addFromPaper: "Add from Paper",
  addJob: "Add a job from Apply",
  pasteLink: "Paste a job link",
  recent: "Recent",
  mode: "Mode",
  free: "Free",
  light: "Light",
  max: "Max",
  pro: "Pro",
  share: "Share",
  limitHeading: "You've reached today's Free limit",
  limitBody: "Pro has unlimited Coach chats.",
  upgrade: "Upgrade",
  open: "Open",
  approve: "Approve",
  deny: "Deny",
  undo: "Undo",
  undone: "Undone",
  stopped: "Stopped",
  tooLong: "Message is too long.",
  pasteFullLink: "Paste a full link.",
  importUnavailable:
    "Import is not available yet. Add a document from Paper.",
  workingPlaceholder: "Coach is working. You can keep typing.",
  linkCopied: "Link copied",
} as const

export function workingLine(seconds: number) {
  return `Working, ${seconds}s`
}

export function workedLine(seconds: number) {
  return `Worked for ${seconds}s`
}

export function changesLine(count: number) {
  return `${count} changes`
}

export function freeModeLine(remaining: number, cap: number) {
  return `Quick edits, ${remaining} of ${cap} left today`
}

export function lightModeLine(cap: number) {
  return `Stronger drafts, ${cap} a day`
}

export function maxModeLine(cap: number) {
  return `Hardest rewrites, ${cap} a day`
}

export function resetsAtLine(time: string) {
  return `Resets at ${time}. Pro has unlimited Coach chats.`
}

export function backAtLine(time: string) {
  return `Coach is back at ${time}`
}

export function backAtPlaceholder(time: string) {
  return `Coach is back at ${time}`
}
