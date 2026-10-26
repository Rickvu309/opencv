export const shellCopy = {
  wordmark: "opencv",
  search: "Search",
  newChat: "New chat",
  inbox: "Inbox",
  coach: "Coach",
  jobs: "Jobs",
  yourWork: "Your work",
  paper: "Paper",
  apply: "Apply",
  pitch: "Pitch",
  favorites: "Favorites",
  settings: "Settings",
  menu: "Menu",
  closeMenu: "Close menu",
  history: "History",
  minimize: "Minimize",
  expand: "Expand",
  close: "Close",
} as const

const DEFAULT_CHAT_TITLE = "New Thread"

export function shellChatTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? ""
  if (!trimmed || trimmed === DEFAULT_CHAT_TITLE) return shellCopy.newChat
  return trimmed
}
