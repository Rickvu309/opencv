import type { JobView } from "@workspace/domain/apply"
import type { PaperFile, PaperView } from "@workspace/domain/paper-doc"

import type { LibraryView } from "./paper-library-entries.ts"
import type { PickerChoice } from "./paper-template-gallery.tsx"

export type PaperImportState =
  | { type: "idle" }
  | { type: "importing"; name: string }
  | { type: "error"; message: string; retry: File | null }

export type Mode =
  | {
      type: "new"
      step: "kind" | "gallery"
      kind?: "cv" | "letter"
      initial?: PickerChoice
    }
  | { type: "letter" }
  | { type: "import" }
  | { type: "rename"; doc: PaperView }
  | { type: "delete"; doc: PaperView }
  | { type: "link"; doc: PaperView }
  | { type: "delete-file"; file: PaperFile }
  | null

export type LibraryState = {
  importState: PaperImportState
  creatingBlank: boolean
  mode: Mode
  view: LibraryView | null
  rename: string
  renameError: string | null
  jobs: JobView[]
  jobsError: string | null
  jobsLoading: boolean
  printTarget: PaperView | null
  printNonce: number
  link: string
}

export type LibraryAction =
  | { type: "import_dialog_opened" }
  | { type: "view_changed"; view: LibraryView }
  | {
      type: "new_dialog_opened"
      step: "kind" | "gallery"
      kind?: "cv" | "letter"
      initial?: PickerChoice
    }
  | { type: "letter_dialog_opened" }
  | { type: "delete_requested"; doc: PaperView }
  | { type: "delete_file_requested"; file: PaperFile }
  | { type: "dialog_closed" }
  | { type: "rename_requested"; doc: PaperView }
  | { type: "rename_typed"; value: string }
  | { type: "rename_rejected"; message: string }
  | { type: "link_dialog_opened"; doc: PaperView }
  | { type: "jobs_loaded"; jobs: JobView[] }
  | { type: "jobs_failed"; message: string }
  | { type: "import_started"; name: string }
  | { type: "import_ended" }
  | { type: "import_failed"; message: string; retry?: File }
  | { type: "blank_started" }
  | { type: "blank_ended" }
  | { type: "link_typed"; link: string }
  | { type: "print_requested"; doc: PaperView }
  | { type: "print_finished" }

export const initialLibrary: LibraryState = {
  importState: { type: "idle" },
  creatingBlank: false,
  mode: null,
  view: null,
  rename: "",
  renameError: null,
  jobs: [],
  jobsError: null,
  jobsLoading: false,
  printTarget: null,
  printNonce: 0,
  link: "",
}

export function libraryReducer(
  state: LibraryState,
  action: LibraryAction
): LibraryState {
  switch (action.type) {
    case "import_dialog_opened":
      return { ...state, mode: { type: "import" } }
    case "view_changed":
      return { ...state, view: action.view }
    case "new_dialog_opened":
      return {
        ...state,
        mode: {
          type: "new",
          step: action.step,
          kind: action.kind,
          initial: action.initial,
        },
      }
    case "letter_dialog_opened":
      return { ...state, mode: { type: "letter" } }
    case "delete_requested":
      return { ...state, mode: { type: "delete", doc: action.doc } }
    case "delete_file_requested":
      return { ...state, mode: { type: "delete-file", file: action.file } }
    case "dialog_closed":
      return { ...state, mode: null }
    case "rename_requested":
      return {
        ...state,
        rename: action.doc.name,
        renameError: null,
        mode: { type: "rename", doc: action.doc },
      }
    case "rename_typed":
      return { ...state, rename: action.value }
    case "rename_rejected":
      return { ...state, renameError: action.message }
    case "link_dialog_opened":
      return {
        ...state,
        mode: { type: "link", doc: action.doc },
        jobs: [],
        jobsError: null,
        jobsLoading: true,
      }
    case "jobs_loaded":
      return { ...state, jobs: action.jobs, jobsLoading: false }
    case "jobs_failed":
      return { ...state, jobsError: action.message, jobsLoading: false }
    case "import_started":
      return {
        ...state,
        mode: null,
        importState: { type: "importing", name: action.name },
      }
    case "import_ended":
      return { ...state, importState: { type: "idle" } }
    case "import_failed":
      return {
        ...state,
        mode: null,
        importState: {
          type: "error",
          message: action.message,
          retry: action.retry ?? null,
        },
      }
    case "blank_started":
      return { ...state, creatingBlank: true }
    case "blank_ended":
      return { ...state, creatingBlank: false }
    case "link_typed":
      return { ...state, link: action.link }
    case "print_requested":
      return {
        ...state,
        printTarget: action.doc,
        printNonce: state.printNonce + 1,
      }
    case "print_finished":
      return { ...state, printTarget: null, printNonce: 0 }
  }
}
