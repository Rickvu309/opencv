import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import {
  photoFields,
  type PhotoErrors,
  type PhotoFields,
} from "./rich-photo-form.ts"

type Editor = ReturnType<typeof mountRichPaperEditor>
type LayoutPhoto = ReturnType<Editor["photos"]>[number]
type State = {
  photo: LayoutPhoto | null
  fields: PhotoFields | null
  errors: PhotoErrors
  busy: boolean
  error: string
  revision: number
}
type Action =
  | { type: "open"; photo: LayoutPhoto | null }
  | { type: "busy"; busy: boolean }
  | { type: "error"; error: string }
  | { type: "refresh" }
  | { type: "fields"; fields: PhotoFields; errors?: PhotoErrors }
  | { type: "validate"; errors: PhotoErrors }
export function photoDraft(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return {
        ...state,
        photo: action.photo,
        fields: action.photo ? photoFields(action.photo) : null,
        errors: {},
        error: "",
      }
    case "busy":
      return {
        ...state,
        busy: action.busy,
        error: action.busy ? "" : state.error,
      }
    case "error":
      return { ...state, error: action.error }
    case "fields":
      return {
        ...state,
        fields: action.fields,
        errors: action.errors ?? {},
        error: "",
      }
    case "validate":
      return { ...state, errors: action.errors }
    case "refresh":
      return { ...state, revision: state.revision + 1 }
  }
}
