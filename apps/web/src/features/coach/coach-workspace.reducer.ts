import type { CoachContextItem } from "@workspace/domain"

export type Attachment = CoachContextItem & { label: string }
export type Picker = "paper" | "job" | "link" | null

export type WorkspaceState = {
  draft: string
  moreIdeas: boolean
  historyOpen: boolean
  search: string
  picker: Picker
  attachments: Attachment[]
  link: string
  linkError: string
  draftChatId: string | null
  addMenuOpened: boolean
}

export type WorkspaceAction =
  | { type: "draft_typed"; value: string }
  | { type: "draft_sent" }
  | { type: "more_ideas_toggled" }
  | { type: "history_opened" }
  | { type: "history_open_changed"; open: boolean }
  | { type: "search_typed"; value: string }
  | { type: "picker_opened"; picker: "paper" | "job" | "link" }
  | { type: "picker_closed" }
  | { type: "add_menu_opened" }
  | { type: "attached"; item: Attachment }
  | { type: "link_attached"; item: Attachment }
  | { type: "link_rejected" }
  | { type: "attachment_removed"; item: Attachment }
  | { type: "link_typed"; value: string }
  | {
      type: "active_chat_changed"
      chatId: string | null
      seeded: string | null
    }

export function initialWorkspaceState(
  draft: string,
  draftChatId: string | null
): WorkspaceState {
  return {
    draft,
    moreIdeas: false,
    historyOpen: false,
    search: "",
    picker: null,
    attachments: [],
    link: "",
    linkError: "",
    draftChatId,
    addMenuOpened: false,
  }
}

function attached(state: WorkspaceState, item: Attachment): WorkspaceState {
  const { attachments } = state
  return {
    ...state,
    attachments: attachments.some(
      (a) => a.kind === item.kind && a.id === item.id
    )
      ? attachments
      : [...attachments, item].slice(0, 8),
    picker: null,
  }
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "draft_typed":
      return { ...state, draft: action.value }
    case "draft_sent":
      return { ...state, draft: "" }
    case "more_ideas_toggled":
      return { ...state, moreIdeas: !state.moreIdeas }
    case "history_opened":
      return { ...state, historyOpen: true }
    case "history_open_changed":
      return { ...state, historyOpen: action.open }
    case "search_typed":
      return { ...state, search: action.value }
    case "picker_opened":
      return { ...state, picker: action.picker }
    case "picker_closed":
      return { ...state, picker: null }
    case "add_menu_opened":
      return { ...state, addMenuOpened: true }
    case "attached":
      return attached(state, action.item)
    case "link_attached":
      return { ...attached(state, action.item), link: "", linkError: "" }
    case "link_rejected":
      return { ...state, linkError: "Paste a full link." }
    case "attachment_removed":
      return {
        ...state,
        attachments: state.attachments.filter((a) => a !== action.item),
      }
    case "link_typed":
      return { ...state, link: action.value }
    case "active_chat_changed": {
      const next = { ...state, draftChatId: action.chatId }
      if (state.draftChatId !== null)
        return { ...next, draft: action.seeded ?? "", attachments: [] }
      return action.seeded ? { ...next, draft: action.seeded } : next
    }
  }
}
