import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"

type Editor = ReturnType<typeof mountRichPaperEditor>
type LayoutPhoto = ReturnType<Editor["photos"]>[number]
type State = {
  photo: LayoutPhoto | null
  busy: boolean
  error: string
  revision: number
}
type Action =
  | { type: "open"; photo: LayoutPhoto | null }
  | { type: "busy"; busy: boolean }
  | { type: "error"; error: string }
  | { type: "refresh" }
  | { type: "draft"; photo: LayoutPhoto }
export function photoDraft(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { ...state, photo: action.photo, error: "" }
    case "busy":
      return {
        ...state,
        busy: action.busy,
        error: action.busy ? "" : state.error,
      }
    case "error":
      return { ...state, error: action.error }
    case "draft":
      return { ...state, photo: action.photo }
    case "refresh":
      return { ...state, revision: state.revision + 1 }
  }
}
