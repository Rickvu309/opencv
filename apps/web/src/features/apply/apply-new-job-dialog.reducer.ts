import type { JobPreview, JobStage } from "@workspace/domain"

const COMPANY_REQUIRED = "Add the company name to save this job."
const TITLE_REQUIRED = "Add the role title to save this job."

export type Draft = {
  url: string
  title: string
  company: string
  location: string
  description: string
  stage: JobStage
  deadline: string
}

export type DialogState = {
  draft: Draft
  preview: JobPreview | null
  titleError: string
  companyError: string
  dateError: string
  busy: boolean
}

export type DialogAction =
  | { type: "fields_edited"; fields: Partial<Draft> }
  | { type: "title_typed"; value: string }
  | { type: "company_typed"; value: string }
  | { type: "link_cleared" }
  | { type: "preview_read"; preview: JobPreview; fields: Partial<Draft> }
  | { type: "save_checked"; titleMissing: boolean; companyMissing: boolean }
  | { type: "date_rejected" }
  | { type: "save_started" }
  | { type: "duplicate_found"; preview: JobPreview }
  | { type: "company_required" }
  | { type: "save_ended" }
  | { type: "closed" }

export const DIALOG_START: DialogState = {
  draft: {
    url: "",
    title: "",
    company: "",
    location: "",
    description: "",
    stage: "saved",
    deadline: "",
  },
  preview: null,
  titleError: "",
  companyError: "",
  dateError: "",
  busy: false,
}

export function dialogReducer(
  state: DialogState,
  action: DialogAction
): DialogState {
  switch (action.type) {
    case "fields_edited":
      return { ...state, draft: { ...state.draft, ...action.fields } }
    case "title_typed":
      return {
        ...state,
        draft: { ...state.draft, title: action.value },
        titleError: action.value.trim() ? "" : state.titleError,
      }
    case "company_typed":
      return {
        ...state,
        draft: { ...state.draft, company: action.value },
        companyError: action.value.trim() ? "" : state.companyError,
      }
    case "link_cleared":
      return {
        ...state,
        draft: { ...state.draft, url: "" },
        preview: null,
      }
    case "preview_read":
      return {
        ...state,
        preview: action.preview,
        draft: { ...state.draft, ...action.fields },
        companyError:
          action.preview.status === "company-missing" ? COMPANY_REQUIRED : "",
      }
    case "save_checked":
      return {
        ...state,
        titleError: action.titleMissing ? TITLE_REQUIRED : "",
        companyError: action.companyMissing ? COMPANY_REQUIRED : "",
      }
    case "date_rejected":
      return { ...state, dateError: "Use a real date." }
    case "save_started":
      return { ...state, dateError: "", busy: true }
    case "duplicate_found":
      return { ...state, preview: action.preview }
    case "company_required":
      return { ...state, companyError: COMPANY_REQUIRED }
    case "save_ended":
      return { ...state, busy: false }
    case "closed":
      return { ...DIALOG_START, busy: state.busy }
  }
}
