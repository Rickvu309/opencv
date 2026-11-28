export type SyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "offline"
  | "contended"
  | "refused"
  | "stuck"
  | "local"

export const SYNC_LABEL: Record<SyncStatus, string> = {
  loading: "Loading",
  saved: "Saved",
  saving: "Saving",
  offline: "Offline, retrying",
  contended: "Busy, retrying",
  refused: "Not saved. Reload the page",
  stuck: "Not merged. Your changes are kept",
  local: "Not kept on this device",
}
