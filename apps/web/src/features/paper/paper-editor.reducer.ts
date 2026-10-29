import type {
  CvBlockDocument,
  PaperPages,
  PaperTemplateId,
  PaperView,
} from "@workspace/domain"

export type EditorState = {
  doc: CvBlockDocument
  undoDoc: CvBlockDocument | null
  name: string
  nameError: string | null
  updatedAt: PaperView["updatedAt"]
  pageState: PaperPages
  conflict: boolean
  favoritePending: boolean
  templateId: PaperTemplateId | null
  galleryOpen: boolean
  previewPages: number
  printJob: { id: number; title: string } | null
}

export type EditorAction =
  | { type: "document_edited"; doc: CvBlockDocument }
  | { type: "document_committed"; doc: CvBlockDocument }
  | { type: "edit_undone" }
  | { type: "document_synced"; doc: CvBlockDocument }
  | { type: "document_adopted"; doc: CvBlockDocument; updatedAt: string }
  | { type: "saved"; at: string }
  | { type: "conflict_detected" }
  | { type: "favorite_started" }
  | { type: "favorite_finished" }
  | { type: "name_typed"; name: string }
  | { type: "name_rejected"; message: string }
  | { type: "name_accepted" }
  | { type: "pages_loaded"; pages: PaperPages }
  | { type: "two_pages_kept" }
  | { type: "template_changed"; templateId: PaperTemplateId | null }
  | { type: "template_applied"; templateId: PaperTemplateId | null }
  | { type: "gallery_opened" }
  | { type: "gallery_closed" }
  | { type: "preview_measured"; pages: number }
  | { type: "print_requested"; title: string }
  | { type: "print_finished" }

export function initialEditor(
  initial: PaperView,
  pages: PaperPages,
  doc: CvBlockDocument
): EditorState {
  return {
    doc,
    undoDoc: null,
    name: initial.name,
    nameError: null,
    updatedAt: initial.updatedAt,
    pageState: pages,
    conflict: false,
    favoritePending: false,
    templateId: initial.templateId,
    galleryOpen: false,
    previewPages: 1,
    printJob: null,
  }
}

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case "document_edited":
      return { ...state, doc: action.doc }
    case "document_committed":
      return { ...state, undoDoc: state.doc, doc: action.doc }
    case "edit_undone":
      return { ...state, undoDoc: null, doc: state.undoDoc ?? state.doc }
    case "document_synced":
      return { ...state, undoDoc: null, doc: action.doc }
    case "document_adopted":
      return {
        ...state,
        undoDoc: null,
        doc: action.doc,
        updatedAt: action.updatedAt,
        conflict: false,
      }
    case "saved":
      return { ...state, updatedAt: action.at, conflict: false }
    case "conflict_detected":
      return { ...state, conflict: true }
    case "favorite_started":
      return { ...state, favoritePending: true }
    case "favorite_finished":
      return { ...state, favoritePending: false }
    case "name_typed":
      return { ...state, name: action.name }
    case "name_rejected":
      return { ...state, nameError: action.message }
    case "name_accepted":
      return { ...state, nameError: null }
    case "pages_loaded":
      return state.pageState === action.pages
        ? state
        : { ...state, pageState: action.pages }
    case "two_pages_kept":
      return { ...state, pageState: { ...state.pageState, pageChoice: "keep" } }
    case "template_changed":
      return { ...state, templateId: action.templateId }
    case "template_applied":
      return { ...state, templateId: action.templateId, galleryOpen: false }
    case "gallery_opened":
      return { ...state, galleryOpen: true }
    case "gallery_closed":
      return { ...state, galleryOpen: false }
    case "preview_measured":
      return state.previewPages === action.pages
        ? state
        : { ...state, previewPages: action.pages }
    case "print_requested":
      return {
        ...state,
        printJob: { id: (state.printJob?.id ?? 0) + 1, title: action.title },
      }
    case "print_finished":
      return { ...state, printJob: null }
  }
}
